import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { forumThreads } from "@/db/schema";
import { FORUM_SECTIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ForumOverviewPage() {
  const counts = await db
    .select({ section: forumThreads.section, count: sql<number>`count(*)::int` })
    .from(forumThreads)
    .groupBy(forumThreads.section);
  const latest = await db
    .select({
      id: forumThreads.id,
      title: forumThreads.title,
      section: forumThreads.section,
      authorName: forumThreads.authorName,
      createdAt: forumThreads.createdAt,
    })
    .from(forumThreads)
    .orderBy(desc(forumThreads.lastPostAt))
    .limit(6);

  const countMap = new Map(counts.map((row) => [row.section, row.count]));

  return (
    <div className="space-y-5">
      <header className="anim-fade-up">
        <h1 className="text-xl font-bold text-white">Forum</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Scripts, support, suggestions and general discussion.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {FORUM_SECTIONS.map((section, index) => (
          <Link
            key={section.key}
            href={`/dashboard/forum/${section.key}`}
            className="card card-hover anim-fade-up flex items-start justify-between gap-4 p-5"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{section.icon}</span>
                <h2 className="text-sm font-semibold text-white">{section.label}</h2>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{section.blurb}</p>
            </div>
            <span className="tag shrink-0">{countMap.get(section.key) ?? 0} threads</span>
          </Link>
        ))}
      </div>

      <section className="card anim-fade-up p-5">
        <h2 className="text-sm font-semibold text-white">Latest activity</h2>
        <ul className="mt-4 space-y-2">
          {latest.length === 0 && <li className="text-xs text-zinc-500">Nothing posted yet.</li>}
          {latest.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/dashboard/forum/thread/${thread.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1d1d24] bg-[#0b0b0f] px-3 py-2.5 transition hover:border-[#4a1414]"
              >
                <span className="truncate text-xs text-zinc-200">{thread.title}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">
                  {thread.section} · {thread.authorName} · {thread.createdAt.toISOString().slice(0, 10)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
