import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcementReads, announcements } from "@/db/schema";
import { ApiError, ok, parseBody, requireUser, route, forbidden } from "@/lib/api";
import { announcementSchema } from "@/lib/validation";
import { permissions } from "@/lib/permissions";
import { requireUserRow } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    .limit(60);
  const reads = await db
    .select({ announcementId: announcementReads.announcementId })
    .from(announcementReads)
    .where(eq(announcementReads.userId, user.id));
  const readSet = new Set(reads.map((r) => r.announcementId));
  return ok({
    announcements: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      authorName: row.authorName,
      pinned: row.pinned,
      createdAt: row.createdAt.toISOString(),
      read: readSet.has(row.id),
    })),
  });
});

export const POST = route(
  async (req) => {
    const actor = await requireUserRow();
    if (!permissions.postAnnouncements(actor.role)) throw forbidden("Admins only.");
    const body = await parseBody(req, announcementSchema);
    const [created] = await db
      .insert(announcements)
      .values({
        title: body.title,
        body: body.body,
        pinned: body.pinned ?? false,
        authorId: actor.id,
        authorName: actor.username,
      })
      .returning({ id: announcements.id });
    await logAudit({
      actor,
      action: "announcement.create",
      details: body.title,
      ip: clientIp(req),
    });
    return ok({ id: created?.id }, 201);
  },
  { limit: { key: "announcements", max: 20, windowMs: 60_000 } },
);

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid announcement id.");
  await db
    .insert(announcementReads)
    .values({ announcementId: id, userId: user.id })
    .onConflictDoNothing();
  return ok({ id });
});
