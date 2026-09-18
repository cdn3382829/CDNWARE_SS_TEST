import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { executorPresence } from "@/db/schema";
import { ApiError, badRequest, ok, parseBody, requireCompleteUser, route } from "@/lib/api";
import { canAccessGame, getGame } from "@/lib/games";
import { generateServers, searchServers } from "@/lib/servers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const attachSchema = z.object({ serverId: z.string().trim().min(3).max(40) });

async function loadServers(gameId: number, placeId: string) {
  const presence = await db
    .select({ serverId: executorPresence.serverId, username: executorPresence.username })
    .from(executorPresence)
    .where(
      and(
        eq(executorPresence.gameId, gameId),
        gt(executorPresence.lastSeenAt, new Date(Date.now() - 1000 * 60 * 3)),
      ),
    );
  return generateServers(placeId, presence);
}

export const GET = route(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompleteUser();
    const { id } = await ctx.params;
    const game = await getGame(Number(id));
    if (!game) throw new ApiError(404, "Game not found.");
    if (!(await canAccessGame(user, game))) throw new ApiError(403, "Your tier does not include this game.");

    const servers = await loadServers(game.id, game.placeId);
    const player = new URL(req.url).searchParams.get("player")?.slice(0, 40) ?? "";

    return ok({
      game: {
        id: game.id,
        name: game.name,
        placeId: game.placeId,
        playerCount: game.playerCount,
        visits: game.visits,
        creator: game.creator,
      },
      servers,
      matches: player ? searchServers(servers, player) : [],
      tick: Date.now(),
    });
  },
  { limit: { key: "servers", max: 240, windowMs: 60_000 } },
);

/** Attach: records that the user is sitting in a server so others can find them. */
export const POST = route(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompleteUser();
    const { id } = await ctx.params;
    const game = await getGame(Number(id));
    if (!game) throw new ApiError(404, "Game not found.");
    if (!(await canAccessGame(user, game))) throw new ApiError(403, "Your tier does not include this game.");
    const body = await parseBody(req, attachSchema);
    const servers = await loadServers(game.id, game.placeId);
    if (!servers.some((s) => s.id === body.serverId)) throw badRequest("Unknown server id.");

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
        set: { lastSeenAt: new Date(), username: user.username },
      });

    return ok({ attached: true, serverId: body.serverId });
  },
  { limit: { key: "attach", max: 90, windowMs: 60_000 } },
);
