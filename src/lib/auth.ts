import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { createSessionToken, sha256 } from "@/lib/security";
import { effectiveStatus, type AccountStatus, type Role, type SessionUser, type Tier } from "@/lib/permissions";

export const SESSION_COOKIE = "cdn_ss_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type DbUserRow = typeof users.$inferSelect;

export function toSessionUser(row: DbUserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role as Role,
    tier: row.tier as Tier,
    status: effectiveStatus({
      status: row.status as AccountStatus,
      suspendedUntil: row.suspendedUntil,
    }) as AccountStatus,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    scriptsExecuted: row.scriptsExecuted,
    strikes: row.strikes,
    acceptedTos: row.acceptedTos,
    acceptedTosVersion: row.acceptedTosVersion,
    acceptedRulesVersion: row.acceptedRulesVersion,
    onboardingComplete: row.onboardingComplete,
    suspendedUntil: row.suspendedUntil ? row.suspendedUntil.toISOString() : null,
    suspensionReason: row.suspensionReason,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createSession(userId: number, ip: string, userAgent: string) {
  const { token, tokenHash } = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash, userId, ip, userAgent, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) return null;
  const tokenHash = sha256(token);
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const sessionUser = toSessionUser(row.user);
  // Hard gate: blacklisted or frozen accounts are never allowed an active session.
  if (sessionUser.status === "blacklisted" || sessionUser.status === "frozen") {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return null;
  }
  return sessionUser;
}

export async function getUserRow(userId: number): Promise<DbUserRow | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}
