import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { forumPosts, forumThreads } from "@/db/schema";
import { ApiError, badRequest, ok, parseBody, requireCompleteUser, route } from "@/lib/api";
import { forumThreadSchema } from "@/lib/validation";
import { isForumSection } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireCompleteUser();
  const section = new URL(req.url).searchParams.get("section") ?? "";
  if (!isForumSection(section)) throw badRequest("Unknown forum section.");
  const rows = await db
    .select()
    .from(forumThreads)
    .where(eq(forumThreads.section, section as "scripts"))
    .orderBy(desc(forumThreads.pinned), desc(forumThreads.lastPostAt))
    .limit(80);
  return ok({
    threads: rows.map((row) => ({
      id: row.id,
      title: row.title,
      authorName: row.authorName,
      pinned: row.pinned,
      locked: row.locked,
      replyCount: row.replyCount,
      views: row.views,
      lastPostAt: row.lastPostAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

export const POST = route(
  async (req) => {
    const user = await requireCompleteUser();
    const body = await parseBody(req, forumThreadSchema);
    if (!isForumSection(body.section)) throw badRequest("Unknown forum section.");
    const [thread] = await db
      .insert(forumThreads)
      .values({
        section: body.section,
        title: body.title,
        authorId: user.id,
        authorName: user.username,
      })
      .returning({ id: forumThreads.id });
    if (!thread) throw new ApiError(500, "Could not create the thread.");
    await db.insert(forumPosts).values({
      threadId: thread.id,
      authorId: user.id,
      authorName: user.username,
      authorRole: user.role,
      body: body.body,
      attachments: body.attachments ?? [],
    });
    await db
      .update(forumThreads)
      .set({ replyCount: sql`${forumThreads.replyCount} + 1` })
      .where(eq(forumThreads.id, thread.id));
    return ok({ id: thread.id }, 201);
  },
  { limit: { key: "forum-thread", max: 12, windowMs: 60_000 * 10 } },
);
