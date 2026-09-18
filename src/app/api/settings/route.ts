import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ApiError, ok, parseBody, requireUserRow, route } from "@/lib/api";
import { profileSchema } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/security";
import { toSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export const PATCH = route(async (req) => {
  const row = await requireUserRow();
  const body = await parseBody(req, profileSchema);
  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  let passwordChanged = false;

  if (body.username && body.username.toLowerCase() !== row.usernameLower) {
    const clash = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.usernameLower, body.username.toLowerCase()))
      .limit(1);
    if (clash[0]) throw new ApiError(409, "That username is taken.");
    updates.username = body.username;
    updates.usernameLower = body.username.toLowerCase();
  }

  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;

  if (body.newPassword) {
    if (!body.currentPassword) {
      throw new ApiError(400, "Enter your current password to set a new one.");
    }
    const valid = await verifyPassword(body.currentPassword, row.passwordHash);
    if (!valid) throw new ApiError(403, "Current password is incorrect.");
    updates.passwordHash = await hashPassword(body.newPassword);
    passwordChanged = true;
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, row.id)).returning();
  if (!updated) throw new ApiError(500, "Could not update profile.");

  if (passwordChanged) {
    // Invalidate every session after a credential change so the user re-auths.
    await db.delete(sessions).where(eq(sessions.userId, row.id));
    await logAudit({
      actor: updated,
      action: "account.password_change",
      targetId: updated.id,
      targetName: updated.username,
      ip: clientIp(req),
    });
    return ok({ user: toSessionUser(updated), reauth: true });
  }

  await logAudit({
    actor: updated,
    action: "account.profile_update",
    targetId: updated.id,
    targetName: updated.username,
    details: Object.keys(updates).filter((k) => k !== "updatedAt").join(", "),
    ip: clientIp(req),
  });
  return ok({ user: toSessionUser(updated) });
});

export const GET = route(async () => {
  const row = await requireUserRow();
  void or;
  return ok({ user: toSessionUser(row) });
});
