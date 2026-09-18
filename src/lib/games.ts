import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { games, privateGameAccess } from "@/db/schema";
import type { SessionUser } from "@/lib/permissions";

export type GameRow = typeof games.$inferSelect;

export type VisibleGame = {
  id: number;
  name: string;
  placeId: string;
  creator: string;
  playerCount: number;
  visits: number;
  tier: "standard" | "premium" | "private";
  locked: boolean;
};

/** Games the user can currently open, without leaking tier names for standard. */
export async function visibleGames(user: SessionUser): Promise<VisibleGame[]> {
  const rows = await db
    .select()
    .from(games)
    .where(eq(games.approved, true))
    .orderBy(desc(games.playerCount));

  const grants = await db
    .select({ gameId: privateGameAccess.gameId })
    .from(privateGameAccess)
    .where(eq(privateGameAccess.userId, user.id));
  const granted = new Set(grants.map((g) => g.gameId));

  return rows
    .filter((row) => {
      if (row.tier === "private") return granted.has(row.id) || user.role !== "member";
      if (row.tier === "standard") return true;
      return user.tier === "premium" || user.role !== "member";
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      placeId: row.placeId,
      creator: row.creator,
      playerCount: row.playerCount,
      visits: row.visits,
      tier: row.tier,
      locked:
        row.tier === "premium" ? user.tier !== "premium" && user.role === "member" : false,
    }));
}

export async function canAccessGame(user: SessionUser, game: GameRow): Promise<boolean> {
  if (!game.approved) return user.role !== "member";
  if (game.tier === "standard") return true;
  if (game.tier === "premium") return user.tier === "premium" || user.role !== "member";
  if (user.role !== "member") return true;
  const grants = await db
    .select({ id: privateGameAccess.id })
    .from(privateGameAccess)
    .where(and(eq(privateGameAccess.userId, user.id), eq(privateGameAccess.gameId, game.id)))
    .limit(1);
  return grants.length > 0;
}

export async function getGame(id: number): Promise<GameRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const rows = await db.select().from(games).where(eq(games.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function pendingGames(): Promise<GameRow[]> {
  return db.select().from(games).where(eq(games.approved, false)).orderBy(desc(games.createdAt));
}

export async function allGames(): Promise<GameRow[]> {
  return db.select().from(games).orderBy(desc(games.playerCount));
}

export async function grantPrivateGames(userId: number, gameIds: number[]) {
  if (gameIds.length === 0) {
    await db.delete(privateGameAccess).where(eq(privateGameAccess.userId, userId));
    return;
  }
  const existing = await db
    .select({ gameId: privateGameAccess.gameId })
    .from(privateGameAccess)
    .where(eq(privateGameAccess.userId, userId));
  const keep = new Set(existing.map((e) => e.gameId));
  const toAdd = gameIds.filter((id) => !keep.has(id));
  if (toAdd.length > 0) {
    await db
      .insert(privateGameAccess)
      .values(toAdd.map((gameId) => ({ userId, gameId })))
      .onConflictDoNothing();
  }
  const keepSet = new Set(gameIds);
  const toRemove = [...keep].filter((id) => !keepSet.has(id));
  if (toRemove.length > 0) {
    await db
      .delete(privateGameAccess)
      .where(
        and(eq(privateGameAccess.userId, userId), inArray(privateGameAccess.gameId, toRemove)),
      );
  }
}
