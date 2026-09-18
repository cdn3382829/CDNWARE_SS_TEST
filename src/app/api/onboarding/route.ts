import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, ok, parseBody, requireUser, route } from "@/lib/api";
import { onboardingSchema } from "@/lib/validation";
import { getSettings } from "@/lib/settings";
import { toSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const sessionUser = await requireUser();
  const body = await parseBody(req, onboardingSchema);
  const settings = await getSettings();

  const rows = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, "Account not found.");

  if (body.step === "tos") {
    if (body.version !== settings.tosVersion) {
      throw new ApiError(409, "The terms changed while you were reading. Please re-read them.");
    }
    if (!row.acceptedTos) {
      await db
        .update(users)
        .set({ acceptedTos: true, acceptedTosVersion: settings.tosVersion, updatedAt: new Date() })
        .where(eq(users.id, row.id));
    }
    return ok({ next: "/onboarding/rules" });
  }

  if (!row.acceptedTos) throw new ApiError(400, "Accept the Terms of Service first.");
  if (body.version !== settings.rulesVersion) {
    throw new ApiError(409, "The rules changed while you were reading. Please re-read them.");
  }
  await db
    .update(users)
    .set({
      acceptedRulesVersion: settings.rulesVersion,
      onboardingComplete: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, row.id));

  const updated = await db.select().from(users).where(eq(users.id, row.id)).limit(1);
  return ok({ next: "/dashboard", user: updated[0] ? toSessionUser(updated[0]) : null });
});
