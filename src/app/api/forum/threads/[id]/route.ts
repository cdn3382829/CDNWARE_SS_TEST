import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { forumPosts, forumThreads } from "@/db/schema";
import { ApiError, ok, parseBody, requireCompleteUser, route } from "@/lib/api";
import { forumReplySchema } from "@/lib/validation";
import { permissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/security";
import { requireUserRow } from "@/lib/api";

export const dynamic = "force-dynamic";

const moderateSchema = z.object({
  action: z.enum(["pin", "unpin", "lock", "unlock", "delete"]),
});

async function getThread(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const rows = await db.select().from(forumThreads).where(eq(forumThreads.id, id)).limit(1);
  return rows[0] ?? null;
}

export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireCompleteUser();
  const { id } = await ctx.params;
  const thread = await getThread(Number(id));
  if (!thread) throw new ApiError(404, "Thread not found.");
  const posts = await db
    .select()
    .from(forumPosts)
    .where(eq(forumPosts.threadId, thread.id))
    .orderBy(asc(forumPosts.createdAt))
    .limit(400);
  await db
    .update(forumThreads)
    .set({ views: sql`${forumThreads.views} + 1` })
    .where(eq(forumThreads.id, thread.id));
  return ok({
    thread: {
      id: thread.id,
      section: thread.section,
      title: thread.title,
      authorName: thread.authorName,
      pinned: thread.pinned,
      locked: thread.locked,
      replyCount: thread.replyCount,
      createdAt: thread.createdAt.toISOString(),
    },
    posts: posts.map((post) => ({
      id: post.id,
      authorName: post.authorName,
      authorRole: post.authorRole,
      body: post.body,
      attachments: post.attachments,
      createdAt: post.createdAt.toISOString(),
    })),
  });
});

export const POST = route(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompleteUser();
    const { id } = await ctx.params;
    const thread = await getThread(Number(id));
    if (!thread) throw new ApiError(404, "Thread not found.");
    if (thread.locked && user.role === "member") {
      throw new ApiError(403, "This thread is locked.");
    }
    const body = await parseBody(req, forumReplySchema);
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
      .set({ replyCount: sql`${forumThreads.replyCount} + 1`, lastPostAt: new Date() })
      .where(eq(forumThreads.id, thread.id));
    return ok({ replied: true }, 201);
  },
  { limit: { key: "forum-reply", max: 30, windowMs: 60_000 } },
);

export const PATCH = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireUserRow();
  if (!permissions.moderateForum(actor.role)) throw new ApiError(403, "Staff only.");
  const { id } = await ctx.params;
  const thread = await getThread(Number(id));
  if (!thread) throw new ApiError(404, "Thread not found.");
  const body = await parseBody(req, moderateSchema);

  if (body.action === "delete") {
    await db.delete(forumPosts).where(eq(forumPosts.threadId, thread.id));
    await db.delete(forumThreads).where(eq(forumThreads.id, thread.id));
  } else {
    const patch =
      body.action === "pin"
        ? { pinned: true }
        : body.action === "unpin"
          ? { pinned: false }
          : body.action === "lock"
            ? { locked: true }
            : { locked: false };
    await db.update(forumThreads).set(patch).where(eq(forumThreads.id, thread.id));
  }

  await logAudit({
    actor,
    action: `forum.${body.action}`,
    targetId: thread.id,
    targetName: thread.title.slice(0, 24),
    ip: clientIp(req),
  });
  return ok({ done: body.action });
});
