import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blacklistedScripts, users } from "@/db/schema";
import { ApiError, forbidden, ok, parseBody, requireUserRow, route } from "@/lib/api";
import { blacklistScriptSchema } from "@/lib/validation";
import { permissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const actor = await requireUserRow();
  if (!permissions.manageScriptBlacklist(actor.role)) throw forbidden("Admins only.");
  const rows = await db
    .select({
      id: blacklistedScripts.id,
      pattern: blacklistedScripts.pattern,
      matchType: blacklistedScripts.matchType,
      action: blacklistedScripts.action,
      reason: blacklistedScripts.reason,
      active: blacklistedScripts.active,
      createdAt: blacklistedScripts.createdAt,
      creatorName: users.username,
    })
    .from(blacklistedScripts)
    .leftJoin(users, eq(users.id, blacklistedScripts.createdBy))
    .orderBy(desc(blacklistedScripts.createdAt))
    .limit(200);
  return ok({
    patterns: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  });
});

export const POST = route(
  async (req) => {
    const actor = await requireUserRow();
    if (!permissions.manageScriptBlacklist(actor.role)) throw forbidden("Admins only.");
    const body = await parseBody(req, blacklistScriptSchema);
    if (body.matchType === "regex") {
      try {
        new RegExp(body.pattern);
      } catch {
        throw new ApiError(400, "That regex pattern does not compile.");
      }
    }
    const [created] = await db
      .insert(blacklistedScripts)
      .values({
        pattern: body.pattern,
        matchType: body.matchType,
        action: body.action,
        reason: body.reason,
        createdBy: actor.id,
      })
      .returning({ id: blacklistedScripts.id });
    await logAudit({
      actor,
      action: "filter.create",
      details: `${body.matchType}:${body.action} — ${body.reason}`,
      ip: clientIp(req),
    });
    return ok({ id: created?.id ?? null }, 201);
  },
  { limit: { key: "filter-create", max: 40, windowMs: 60_000 } },
);

export const DELETE = route(async (req) => {
  const actor = await requireUserRow();
  if (!permissions.manageScriptBlacklist(actor.role)) throw forbidden("Admins only.");
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid pattern id.");
  const deleted = await db
    .update(blacklistedScripts)
    .set({ active: false })
    .where(eq(blacklistedScripts.id, id))
    .returning({ id: blacklistedScripts.id });
  if (deleted.length === 0) throw new ApiError(404, "Pattern not found.");
  await logAudit({ actor, action: "filter.disable", details: `pattern #${id}`, ip: clientIp(req) });
  return ok({ disabled: id });
});
