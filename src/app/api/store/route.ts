import { ok, requireCompleteUser, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { tierLabel } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireCompleteUser();
  const settings = await getSettings();
  return ok({
    tier: user.tier,
    tierLabel: tierLabel(user.tier),
    standard: { price: settings.standardPrice, link: settings.standardLink },
    premium: { price: settings.premiumPrice, link: settings.premiumLink },
  });
});
