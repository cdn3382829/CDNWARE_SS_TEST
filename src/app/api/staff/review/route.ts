import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { blacklists, executionLogs, sessions, suspensions, users } from "@/db/schema";
import { ApiError, forbidden, ok, parseBody, requireUserRow, route } from "@/lib/api";
import { reviewDecisionSchema } from "@/lib/validation";
import { isAdmin, isStaff, permissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "escalated", "cleared", "actioned", "flagged", "all"] as const;

export const GET = route(async (req) => {
  const actor = await requireUserRow();
  if (!isStaff(actor.role)) throw forbidden("Staff only.");

  const url = new URL(req.url);
  const statusParam = (url.searchParams.get("status") ?? "pending") as (typeof STATUSES)[number];
  const status = STATUSES.includes(statusParam) ? statusParam : "pending";
  const logId = Number(url.searchParams.get("logId") ?? 0);

  if (logId > 0) {
    const rows = await db.select().from(executionLogs).where(eq(executionLogs.id, logId)).limit(1);
    const log = rows[0];
    if (!log) throw new ApiError(404, "Log not found.");
    const authorRows = await db
      .select({
        id: users.id,
        username: users.username,
        status: users.status,
        tier: users.tier,
        strikes: users.strikes,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, log.userId))
      .limit(1);
    return ok({
      log: {
        ...log,
        createdAt: log.createdAt.toISOString(),
        author: authorRows[0] ?? null,
      },
    });
  }

  const where =
    status === "all"
      ? undefined
      : status === "flagged"
        ? eq(executionLogs.flagged, true)
        : eq(executionLogs.reviewStatus, status);

  const rows = await db
    .select({
      id: executionLogs.id,
      username: executionLogs.username,
      userId: executionLogs.userId,
      gameName: executionLogs.gameName,
      serverId: executionLogs.serverId,
      flagged: executionLogs.flagged,
      flagReason: executionLogs.flagReason,
      reviewStatus: executionLogs.reviewStatus,
      outcome: executionLogs.outcome,
      scriptLength: executionLogs.scriptLength,
      preview: sql<string>`left(${executionLogs.scriptContent}, 220)`,
      createdAt: executionLogs.createdAt,
    })
    .from(executionLogs)
    .where(where)
    .orderBy(desc(executionLogs.createdAt))
    .limit(120);

  return ok({
    status,
    canSeeIp: permissions.viewIp(actor.role),
    logs: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  });
});

export const POST = route(
  async (req) => {
    const actor = await requireUserRow();
    if (!isStaff(actor.role)) throw forbidden("Staff only.");
    const body = await parseBody(req, reviewDecisionSchema);
    const ip = clientIp(req);

    const rows = await db.select().from(executionLogs).where(eq(executionLogs.id, body.logId)).limit(1);
    const log = rows[0];
    if (!log) throw new ApiError(404, "Log not found.");
    const targetRows = await db.select().from(users).where(eq(users.id, log.userId)).limit(1);
    const target = targetRows[0];
    if (!target) throw new ApiError(404, "Author not found.");
    if (target.role === "owner") throw forbidden("Cannot moderate the Owner.");

    const audit = (action: string, details: string) =>
      logAudit({ actor, action, targetId: target.id, targetName: target.username, details, ip });

    const markReviewed = (outcome: string, reviewStatus: string) =>
      db
        .update(executionLogs)
        .set({
          reviewStatus: reviewStatus as "cleared",
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          outcome,
          flagged: body.decision !== "clear",
          flagReason: body.decision === "clear" ? null : body.reason,
        })
        .where(eq(executionLogs.id, log.id));

    switch (body.decision) {
      case "clear": {
        await markReviewed("cleared", "cleared");
        await audit("review.clear", `log #${log.id}: ${body.reason}`);
        break;
      }
      case "suspend": {
        const endsAt =
          body.days && body.days > 0 ? new Date(Date.now() + body.days * 86_400_000) : null;
        await db
          .update(users)
          .set({
            status: "suspended",
            suspensionReason: body.reason,
            suspendedUntil: endsAt,
            updatedAt: new Date(),
          })
          .where(eq(users.id, target.id));
        await db.insert(suspensions).values({
          userId: target.id,
          issuedBy: actor.id,
          issuerName: actor.username,
          reason: body.reason,
          endsAt,
        });
        await db.delete(sessions).where(eq(sessions.userId, target.id));
        await markReviewed("suspended", "actioned");
        await audit("review.suspend", `log #${log.id}: ${body.reason}`);
        break;
      }
      case "freeze": {
        await db
          .update(users)
          .set({
            status: "frozen",
            freezeReason: body.reason,
            frozenBy: actor.id,
            suspensionReason: body.reason,
            updatedAt: new Date(),
          })
          .where(eq(users.id, target.id));
        await db.insert(suspensions).values({
          userId: target.id,
          issuedBy: actor.id,
          issuerName: actor.username,
          reason: `FROZEN: ${body.reason}`,
        });
        await db.delete(sessions).where(eq(sessions.userId, target.id));
        await markReviewed("frozen", "escalated");
        await audit("review.freeze", `log #${log.id}: ${body.reason}`);
        break;
      }
      case "blacklist": {
        if (!isAdmin(actor.role)) throw forbidden("Admins can blacklist.");
        await db
          .update(users)
          .set({
            status: "blacklisted",
            blacklistReason: body.reason,
            blacklistedBy: actor.id,
            updatedAt: new Date(),
          })
          .where(eq(users.id, target.id));
        await db.insert(blacklists).values({
          userId: target.id,
          blacklistedBy: actor.id,
          blacklistedByName: actor.username,
          reason: body.reason,
        });
        await db.delete(sessions).where(eq(sessions.userId, target.id));
        await markReviewed("blacklisted", "actioned");
        await audit("review.blacklist", `log #${log.id}: ${body.reason}`);
        break;
      }
      case "escalate": {
        await markReviewed("escalated", "escalated");
        await audit("review.escalate", `log #${log.id}: ${body.reason}`);
        break;
      }
      default:
        throw new ApiError(400, "Unknown decision.");
    }

    return ok({ done: body.decision });
  },
  { limit: { key: "review-action", max: 60, windowMs: 60_000 } },
);
