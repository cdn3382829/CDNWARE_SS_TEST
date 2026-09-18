import { desc, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { badRequest, ok, requireUserRow, route, forbidden } from "@/lib/api";
import { permissions, isStaff } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const actor = await requireUserRow();
  if (!isStaff(actor.role)) throw forbidden("Staff only.");

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) throw badRequest("Enter at least 2 characters to search.");
  if (q.length > 254) throw badRequest("Search query too long.");

  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      tier: users.tier,
      status: users.status,
      strikes: users.strikes,
      scriptsExecuted: users.scriptsExecuted,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      lastIp: users.lastIp,
    })
    .from(users)
    .where(
      or(sql`${users.usernameLower} like ${like}`, sql`lower(${users.email}) like ${like}`),
    )
    .orderBy(desc(users.createdAt))
    .limit(40);

  const canSeeIp = permissions.viewIp(actor.role);
  return ok({
    users: rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      tier: row.tier,
      status: row.status,
      strikes: row.strikes,
      scriptsExecuted: row.scriptsExecuted,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      lastIp: canSeeIp ? row.lastIp : null,
    })),
  });
});
