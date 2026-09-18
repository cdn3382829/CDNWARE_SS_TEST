import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { announcementReads, announcements, executionLogs, siteSettings } from "@/db/schema";
import { ok, requireCompleteUser, route } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return ok({ user: null });

  const readRows = await db
    .select({ announcementId: announcementReads.announcementId })
    .from(announcementReads)
    .where(eq(announcementReads.userId, user.id));
  const readSet = new Set(readRows.map((r) => r.announcementId));
  const unreadRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(announcements);
  const total = unreadRows[0]?.count ?? 0;

  const settingsRows = await db
    .select({ rulesVersion: siteSettings.rulesVersion, rulesUpdatedAt: siteSettings.rulesUpdatedAt })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);
  const rulesVersion = settingsRows[0]?.rulesVersion ?? 0;
  const rulesUpdated = user.acceptedRulesVersion < rulesVersion;

  let pendingReviews = 0;
  if (user.role !== "member") {
    const pending = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(executionLogs)
      .where(
        and(
          sql`${executionLogs.reviewStatus} in ('pending', 'escalated')`,
          gt(executionLogs.createdAt, new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)),
        ),
      );
    pendingReviews = pending[0]?.count ?? 0;
  }

  return ok({
    user,
    unreadAnnouncements: Math.max(0, total - readSet.size),
    rulesUpdated,
    rulesVersion,
    pendingReviews,
  });
});
