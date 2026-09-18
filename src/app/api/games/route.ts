import { ok, requireCompleteUser, route } from "@/lib/api";
import { visibleGames } from "@/lib/games";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireCompleteUser();
  const list = await visibleGames(user);
  return ok({ games: list, tier: user.tier });
});
