import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { ApiError, forbidden, ok, parseBody, requireUserRow, route } from "@/lib/api";
import { ownerSettingsSchema } from "@/lib/validation";
import { getSettings } from "@/lib/settings";
import { isOwner } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const actor = await requireUserRow();
  if (!isOwner(actor.role)) throw forbidden("Owner only.");
  const settings = await getSettings();
  return ok({ settings });
});

export const PUT = route(async (req) => {
  const actor = await requireUserRow();
  if (!isOwner(actor.role)) throw forbidden("Owner only.");
  const body = await parseBody(req, ownerSettingsSchema);
  const current = await getSettings();
  const updates: Partial<typeof siteSettings.$inferInsert> = { updatedAt: new Date() };
  const notes: string[] = [];

  if (body.rulesContent !== undefined && body.rulesContent !== current.rulesContent) {
    updates.rulesContent = body.rulesContent;
    updates.rulesVersion = current.rulesVersion + 1;
    updates.rulesUpdatedAt = new Date();
    notes.push(`rules v${current.rulesVersion} -> v${current.rulesVersion + 1}`);
  }
  if (body.tosContent !== undefined && body.tosContent !== current.tosContent) {
    updates.tosContent = body.tosContent;
    updates.tosVersion = current.tosVersion + 1;
    notes.push(`tos v${current.tosVersion} -> v${current.tosVersion + 1}`);
  }
  if (body.standardLink !== undefined) updates.standardLink = body.standardLink;
  if (body.premiumLink !== undefined) updates.premiumLink = body.premiumLink;
  if (body.standardPrice !== undefined) updates.standardPrice = body.standardPrice;
  if (body.premiumPrice !== undefined) updates.premiumPrice = body.premiumPrice;

  const [updated] = await db
    .update(siteSettings)
    .set(updates)
    .where(eq(siteSettings.id, 1))
    .returning();
  if (!updated) throw new ApiError(500, "Could not save settings.");

  await logAudit({
    actor,
    action: "settings.update",
    details: notes.join(", ") || "store links updated",
    ip: clientIp(req),
  });

  return ok({
    settings: updated,
    rulesVersion: updated.rulesVersion,
    tosVersion: updated.tosVersion,
  });
});
