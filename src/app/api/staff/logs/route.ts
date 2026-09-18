import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { forbidden, ok, requireUserRow, route } from "@/lib/api";
import { permissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const actor = await requireUserRow();
  if (!permissions.viewAuditLogs(actor.role)) throw forbidden("Admins only.");
  const limit = Math.min(300, Math.max(10, Number(new URL(req.url).searchParams.get("limit") ?? 120)));
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  return ok({
    logs: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  });
});
