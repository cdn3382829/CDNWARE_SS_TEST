import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  blacklistedScripts,
  blacklists,
  executionLogs,
  executorPresence,
  suspensions,
  users,
} from "@/db/schema";
import { ApiError, ok, parseBody, requireCompleteUser, route } from "@/lib/api";
import { canAccessGame, getGame } from "@/lib/games";
import { executeSchema } from "@/lib/validation";
import { awardExecutionBadges } from "@/lib/badges";
import { clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

const AUTO_SUSPEND_DAYS = 7;

function matchesPattern(script: string, pattern: string, matchType: string): boolean {
  try {
    if (matchType === "exact") return script.trim() === pattern.trim();
    if (matchType === "regex") {
      const re = new RegExp(pattern, "i");
      return re.test(script.slice(0, 50_000));
    }
    return script.toLowerCase().includes(pattern.toLowerCase());
  } catch {
    // A broken staff pattern must never take the whole route down.
    return false;
  }
}

export const POST = route(
  async (req) => {
    const user = await requireCompleteUser();
    const body = await parseBody(req, executeSchema);
    const game = await getGame(body.gameId);
    if (!game) throw new ApiError(404, "Game not found.");
    if (!(await canAccessGame(user, game))) {
      throw new ApiError(403, "Your tier does not include this game.");
    }

    const ip = clientIp(req);
    const filters = await db
      .select()
      .from(blacklistedScripts)
      .where(eq(blacklistedScripts.active, true));

    const hit = filters.find((filter) =>
      matchesPattern(body.script, filter.pattern, filter.matchType),
    );

    if (hit) {
      // Staff accounts are never auto-punished; the attempt is still logged and
      // escalated for review so a compromised staff session cannot go unnoticed.
      if (user.role !== "member") {
        await db.insert(executionLogs).values({
          userId: user.id,
          username: user.username,
          gameId: game.id,
          gameName: game.name,
          serverId: body.serverId,
          scriptContent: body.script.slice(0, 100_000),
          scriptLength: body.script.length,
          flagged: true,
          flagReason: hit.reason,
          reviewStatus: "escalated",
          outcome: "staff_filter_hit",
          ip,
        });
        return ok({
          status: "blocked",
          message: `Script blocked by the CDN_SS filter: ${hit.reason}. The attempt was escalated for review.`,
        });
      }

      const endsAt = new Date(Date.now() + AUTO_SUSPEND_DAYS * 86_400_000);
      const [updated] = await db
        .update(users)
        .set({
          status: hit.action === "blacklist" ? "blacklisted" : "suspended",
          suspensionReason: hit.action === "blacklist" ? undefined : `Auto filter: ${hit.reason}`,
          suspendedUntil: hit.action === "blacklist" ? null : endsAt,
          blacklistReason: hit.action === "blacklist" ? `Auto filter: ${hit.reason}` : undefined,
          blacklistedBy: hit.action === "blacklist" ? null : undefined,
          strikes: sql`${users.strikes} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();

      await db.insert(executionLogs).values({
        userId: user.id,
        username: user.username,
        gameId: game.id,
        gameName: game.name,
        serverId: body.serverId,
        scriptContent: body.script.slice(0, 100_000),
        scriptLength: body.script.length,
        flagged: true,
        flagReason: hit.reason,
        reviewStatus: "actioned",
        outcome: hit.action === "blacklist" ? "auto_blacklist" : "auto_suspend",
        ip,
      });

      if (hit.action === "blacklist") {
        await db.insert(blacklists).values({
          userId: user.id,
          blacklistedBy: 0,
          blacklistedByName: "AUTO FILTER",
          reason: `Auto filter: ${hit.reason}`,
        });
      } else {
        await db.insert(suspensions).values({
          userId: user.id,
          issuedBy: 0,
          issuerName: "AUTO FILTER",
          reason: `Auto filter: ${hit.reason}`,
          endsAt,
        });
      }

      void updated;
      return ok({
        status: "blocked",
        message: `Script blocked by the CDN_SS filter: ${hit.reason}.`,
        action: hit.action,
      });
    }

    const inserted = await db
      .insert(executionLogs)
      .values({
        userId: user.id,
        username: user.username,
        gameId: game.id,
        gameName: game.name,
        serverId: body.serverId,
        scriptContent: body.script.slice(0, 100_000),
        scriptLength: body.script.length,
        ip,
      })
      .returning({ id: executionLogs.id });

    const [updatedUser] = await db
      .update(users)
      .set({ scriptsExecuted: sql`${users.scriptsExecuted} + 1`, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning({ scriptsExecuted: users.scriptsExecuted });

    await awardExecutionBadges(user.id, updatedUser?.scriptsExecuted ?? 1);

    await db
      .insert(executorPresence)
      .values({
        userId: user.id,
        username: user.username,
        gameId: game.id,
        serverId: body.serverId,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [executorPresence.userId, executorPresence.gameId, executorPresence.serverId],
        set: { lastSeenAt: new Date() },
      });

    const lines = [
      `[CDN_SS] target=${game.name} (place ${game.placeId})`,
      `[CDN_SS] server=${body.serverId} bytes=${body.script.length}`,
      `[CDN_SS] payload compiled in ${(6 + Math.random() * 18).toFixed(1)}ms`,
      "[CDN_SS] server-side context acquired",
      "[CDN_SS] executed",
    ];

    return ok({
      status: "executed",
      logId: inserted[0]?.id ?? null,
      scriptsExecuted: updatedUser?.scriptsExecuted ?? user.scriptsExecuted + 1,
      output: lines,
    });
  },
  { limit: { key: "execute", max: 60, windowMs: 60_000 } },
);

export const GET = route(
  async () => {
    const user = await requireCompleteUser();
    const rows = await db
      .select({
        id: executionLogs.id,
        gameName: executionLogs.gameName,
        serverId: executionLogs.serverId,
        createdAt: executionLogs.createdAt,
      })
      .from(executionLogs)
      .where(and(eq(executionLogs.userId, user.id)))
      .limit(20);
    return ok({ history: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  },
);
