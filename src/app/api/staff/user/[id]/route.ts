import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  blacklists,
  games,
  privateGameAccess,
  sessions,
  staffNotes,
  strikes,
  suspensions,
  userBadges,
  users,
} from "@/db/schema";
import { ApiError, forbidden, ok, parseBody, requireUserRow, route } from "@/lib/api";
import { staffActionSchema } from "@/lib/validation";
import { isAdmin, isOwner, permissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/security";
import { grantPrivateGames } from "@/lib/games";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadTarget(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid user id.");
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) throw new ApiError(404, "User not found.");
  return target;
}

/** Guards: nobody touches the owner, staff cannot act above their own rank. */
function assertCanActOn(actorRole: string, target: typeof users.$inferSelect) {
  if (target.role === "owner") {
    throw forbidden("The Owner account cannot be moderated.");
  }
  if (actorRole === "moderator" && target.role !== "member") {
    throw forbidden("Moderators can only act on regular members.");
  }
  if (actorRole === "admin" && (target.role as string) === "owner") {
    throw forbidden("Admins cannot act on the Owner.");
  }
}

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireUserRow();
  const { id } = await ctx.params;
  const target = await loadTarget(Number(id));

  const [strikeRows, suspensionRows, noteRows, blacklistRows, badgeRows, privateRows] =
    await Promise.all([
      db.select().from(strikes).where(eq(strikes.userId, target.id)).orderBy(desc(strikes.createdAt)).limit(50),
      db.select().from(suspensions).where(eq(suspensions.userId, target.id)).orderBy(desc(suspensions.createdAt)).limit(50),
      db.select().from(staffNotes).where(eq(staffNotes.userId, target.id)).orderBy(desc(staffNotes.createdAt)).limit(80),
      db.select().from(blacklists).where(eq(blacklists.userId, target.id)).orderBy(desc(blacklists.createdAt)).limit(10),
      db.select().from(userBadges).where(eq(userBadges.userId, target.id)),
      isOwner(actor.role)
        ? db
            .select({ gameId: privateGameAccess.gameId, gameName: games.name })
            .from(privateGameAccess)
            .innerJoin(games, eq(games.id, privateGameAccess.gameId))
            .where(eq(privateGameAccess.userId, target.id))
        : Promise.resolve([]),
    ]);

  const canSeeIp = permissions.viewIp(actor.role);

  return ok({
    user: {
      id: target.id,
      username: target.username,
      email: target.email,
      role: target.role,
      tier: target.tier,
      status: target.status,
      strikes: target.strikes,
      scriptsExecuted: target.scriptsExecuted,
      bio: target.bio,
      avatarUrl: target.avatarUrl,
      createdAt: target.createdAt.toISOString(),
      lastLoginAt: target.lastLoginAt ? target.lastLoginAt.toISOString() : null,
      suspendedUntil: target.suspendedUntil ? target.suspendedUntil.toISOString() : null,
      suspensionReason: target.suspensionReason,
      blacklistReason: target.blacklistReason,
      freezeReason: target.freezeReason,
      onboardingComplete: target.onboardingComplete,
      lastIp: canSeeIp ? target.lastIp : null,
      lastUserAgent: canSeeIp ? target.lastUserAgent : null,
    },
    strikes: strikeRows.map((s) => ({
      id: s.id,
      reason: s.reason,
      issuerName: s.issuerName,
      createdAt: s.createdAt.toISOString(),
    })),
    suspensions: suspensionRows.map((s) => ({
      id: s.id,
      reason: s.reason,
      issuerName: s.issuerName,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
      active: s.active,
    })),
    notes: noteRows.map((n) => ({
      id: n.id,
      body: n.body,
      authorName: n.authorName,
      createdAt: n.createdAt.toISOString(),
    })),
    blacklists: blacklistRows.map((b) => ({
      id: b.id,
      reason: b.reason,
      blacklistedByName: b.blacklistedByName,
      createdAt: b.createdAt.toISOString(),
    })),
    badges: badgeRows.map((b) => b.code),
    privateGames: privateRows,
    can: {
      viewIp: canSeeIp,
      blacklist: permissions.blacklist(actor.role),
      manageTier: permissions.manageTier(actor.role),
      assignPrivateGames: permissions.assignPrivateGames(actor.role),
      manageRoles: permissions.manageRoles(actor.role),
      freeze: isOwner(actor.role) || isAdmin(actor.role) || actor.role === "moderator",
    },
  });
});

export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireUserRow();
  const { id } = await ctx.params;
  const target = await loadTarget(Number(id));
  const body = await parseBody(req, staffActionSchema);
  const ip = clientIp(req);
  assertCanActOn(actor.role, target);

  const now = new Date();
  const audit = (action: string, details: string) =>
    logAudit({ actor, action, targetId: target.id, targetName: target.username, details, ip });

  switch (body.action) {
    case "suspend": {
      if (!permissions.suspend(actor.role)) throw forbidden();
      const reason = body.reason?.trim();
      if (!reason || reason.length < 3) throw new ApiError(400, "A suspension reason is required.");
      const endsAt = body.days && body.days > 0 ? new Date(Date.now() + body.days * 86_400_000) : null;
      await db
        .update(users)
        .set({
          status: "suspended",
          suspensionReason: reason,
          suspendedUntil: endsAt,
          updatedAt: now,
        })
        .where(eq(users.id, target.id));
      await db.insert(suspensions).values({
        userId: target.id,
        issuedBy: actor.id,
        issuerName: actor.username,
        reason,
        endsAt,
      });
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      await audit("user.suspend", `${reason}${endsAt ? ` (${body.days}d)` : " (permanent)"}`);
      break;
    }
    case "unsuspend": {
      if (!permissions.suspend(actor.role)) throw forbidden();
      await db
        .update(users)
        .set({ status: "active", suspensionReason: null, suspendedUntil: null, updatedAt: now })
        .where(eq(users.id, target.id));
      await db
        .update(suspensions)
        .set({ active: false, liftedAt: now, liftedBy: actor.id })
        .where(sql`${suspensions.userId} = ${target.id} and ${suspensions.active} = true`);
      await audit("user.unsuspend", body.reason ?? "lifted suspension");
      break;
    }
    case "freeze": {
      if (!permissions.suspend(actor.role)) throw forbidden();
      const reason = body.reason?.trim() ?? "Pending admin review";
      await db
        .update(users)
        .set({
          status: "frozen",
          freezeReason: reason,
          frozenBy: actor.id,
          suspensionReason: reason,
          updatedAt: now,
        })
        .where(eq(users.id, target.id));
      await db.insert(suspensions).values({
        userId: target.id,
        issuedBy: actor.id,
        issuerName: actor.username,
        reason: `FROZEN: ${reason}`,
      });
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      await audit("user.freeze", reason);
      break;
    }
    case "unfreeze": {
      if (!isAdmin(actor.role)) throw forbidden("Admins only.");
      await db
        .update(users)
        .set({ status: "active", freezeReason: null, frozenBy: null, updatedAt: now })
        .where(eq(users.id, target.id));
      await db
        .update(suspensions)
        .set({ active: false, liftedAt: now, liftedBy: actor.id })
        .where(sql`${suspensions.userId} = ${target.id} and ${suspensions.active} = true`);
      await audit("user.unfreeze", body.reason ?? "released freeze");
      break;
    }
    case "blacklist": {
      if (!permissions.blacklist(actor.role)) throw forbidden("Admins can blacklist.");
      const reason = body.reason?.trim();
      if (!reason || reason.length < 3) throw new ApiError(400, "A blacklist reason is required.");
      await db
        .update(users)
        .set({
          status: "blacklisted",
          blacklistReason: reason,
          blacklistedBy: actor.id,
          updatedAt: now,
        })
        .where(eq(users.id, target.id));
      await db.insert(blacklists).values({
        userId: target.id,
        blacklistedBy: actor.id,
        blacklistedByName: actor.username,
        reason,
      });
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      await audit("user.blacklist", reason);
      break;
    }
    case "unblacklist": {
      if (!permissions.blacklist(actor.role)) throw forbidden("Admins only.");
      await db
        .update(users)
        .set({ status: "active", blacklistReason: null, blacklistedBy: null, updatedAt: now })
        .where(eq(users.id, target.id));
      await audit("user.unblacklist", body.reason ?? "removed blacklist");
      break;
    }
    case "strike": {
      if (!permissions.issueStrikes(actor.role)) throw forbidden();
      const reason = body.reason?.trim();
      if (!reason || reason.length < 3) throw new ApiError(400, "A strike reason is required.");
      await db.insert(strikes).values({
        userId: target.id,
        issuedBy: actor.id,
        issuerName: actor.username,
        reason,
      });
      await db
        .update(users)
        .set({ strikes: sql`${users.strikes} + 1`, updatedAt: now })
        .where(eq(users.id, target.id));
      await audit("user.strike", reason);
      break;
    }
    case "note": {
      if (!permissions.addNotes(actor.role)) throw forbidden();
      const note = body.reason?.trim();
      if (!note || note.length < 3) throw new ApiError(400, "Note text is required.");
      await db.insert(staffNotes).values({
        userId: target.id,
        authorId: actor.id,
        authorName: actor.username,
        body: note.slice(0, 500),
      });
      await audit("user.note", note.slice(0, 120));
      break;
    }
    case "grant_tier": {
      if (!permissions.manageTier(actor.role)) throw forbidden("Admins only.");
      const tier = body.tier ?? "standard";
      if (tier === "none") throw new ApiError(400, "Use revoke to remove access.");
      await db
        .update(users)
        .set({ tier, updatedAt: now })
        .where(eq(users.id, target.id));
      await audit(`user.tier.${tier}`, body.reason ?? "access granted");
      break;
    }
    case "revoke_tier": {
      if (!permissions.manageTier(actor.role)) throw forbidden("Admins only.");
      await db.update(users).set({ tier: "none", updatedAt: now }).where(eq(users.id, target.id));
      await audit("user.tier.revoked", body.reason ?? "access revoked");
      break;
    }
    case "set_role": {
      if (!permissions.manageRoles(actor.role)) throw forbidden("Owner only.");
      const role = body.role ?? "member";
      if (target.role === "owner") throw forbidden("Cannot change the Owner's role.");
      await db.update(users).set({ role, updatedAt: now }).where(eq(users.id, target.id));
      await audit("user.role", `${target.role} -> ${role}`);
      break;
    }
    case "grant_private_game":
    case "revoke_private_game": {
      if (!permissions.assignPrivateGames(actor.role)) throw forbidden("Owner only.");
      if (!body.gameId) throw new ApiError(400, "A game id is required.");
      const existing = await db
        .select({ gameId: privateGameAccess.gameId })
        .from(privateGameAccess)
        .where(eq(privateGameAccess.userId, target.id));
      const current = existing.map((e) => e.gameId);
      const next =
        body.action === "grant_private_game"
          ? Array.from(new Set([...current, body.gameId]))
          : current.filter((gameId) => gameId !== body.gameId);
      await grantPrivateGames(target.id, next);
      await audit(`user.private_game.${body.action === "grant_private_game" ? "grant" : "revoke"}`, `game #${body.gameId}`);
      break;
    }
    default:
      throw new ApiError(400, "Unknown action.");
  }

  const refreshed = await loadTarget(target.id);
  return ok({ status: refreshed.status, tier: refreshed.tier, role: refreshed.role, strikes: refreshed.strikes });
});
