import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { ApiError, forbidden, ok, parseBody, requireUserRow, route } from "@/lib/api";
import { gameReviewSchema } from "@/lib/validation";
import { allGames } from "@/lib/games";
import { permissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const actor = await requireUserRow();
  if (!permissions.reviewGames(actor.role)) throw forbidden("Owner only.");
  const rows = await allGames();
  return ok({
    games: rows.map((row) => ({
      id: row.id,
      name: row.name,
      placeId: row.placeId,
      creator: row.creator,
      tier: row.tier,
      approved: row.approved,
      playerCount: row.playerCount,
      visits: row.visits,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

export const POST = route(async (req) => {
  const actor = await requireUserRow();
  if (!permissions.reviewGames(actor.role)) throw forbidden("Owner only.");
  const body = await parseBody(req, gameReviewSchema);
  const [updated] = await db
    .update(games)
    .set({
      tier: body.tier,
      approved: body.approve,
      reviewedBy: actor.id,
    })
    .where(eq(games.id, body.gameId))
    .returning();
  if (!updated) throw new ApiError(404, "Game not found.");
  await logAudit({
    actor,
    action: "game.review",
    targetId: updated.id,
    targetName: updated.name,
    details: `${body.approve ? "approved" : "rejected"} as ${body.tier}`,
    ip: clientIp(req),
  });
  return ok({ game: { id: updated.id, tier: updated.tier, approved: updated.approved } });
});
