"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, EmptyState, Notice, Panel, Spinner, Tag, useToast } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { RichEditor } from "@/components/rich-editor";
import { renderMarkup } from "@/lib/markup";
import { roleLabel } from "@/lib/permissions";

type Post = {
  id: number;
  authorName: string;
  authorRole: string;
  body: string;
  attachments: string[];
  createdAt: string;
};

type Thread = {
  id: number;
  section: string;
  title: string;
  authorName: string;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  createdAt: string;
};

const ROLE_TONE: Record<string, "default" | "red" | "amber" | "blue"> = {
  owner: "red",
  admin: "red",
  moderator: "amber",
  member: "default",
};

export function ThreadClient({ id, canModerate }: { id: number; canModerate: boolean }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, push, clear } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await api<{ thread: Thread; posts: Post[] }>(`/api/forum/threads/${id}`);
      setThread(data.thread);
      setPosts(data.posts);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not load the thread.");
    } finally {
      setLoading(false);
    }
  }, [id, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/forum/threads/${id}`, { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      await load();
      push("success", "Reply posted.");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not post the reply.");
    } finally {
      setBusy(false);
    }
  };

  const moderate = async (action: string) => {
    try {
      await api(`/api/forum/threads/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      if (action === "delete") {
        window.location.href = `/dashboard/forum/${thread?.section ?? "talk"}`;
        return;
      }
      await load();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Action failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!thread) {
    return <EmptyState icon="🔍" title="Thread not found" hint="It may have been removed by staff." />;
  }

  return (
    <div className="space-y-5">
      {toast && <Notice kind={toast.kind} onClose={clear}>{toast.text}</Notice>}

      <header className="card anim-fade-up flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <Link
            href={`/dashboard/forum/${thread.section}`}
            className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-[#ff5a5a]"
          >
            ← {thread.section}
          </Link>
          <h1 className="mt-1.5 text-base font-bold text-white">{thread.title}</h1>
          <p className="mt-1 text-[11px] text-zinc-500">
            started by {thread.authorName} · {timeAgo(thread.createdAt)}
          </p>
        </div>
        {canModerate && (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void moderate(thread.pinned ? "unpin" : "pin")}>
              {thread.pinned ? "Unpin" : "Pin"}
            </button>
            <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void moderate(thread.locked ? "unlock" : "lock")}>
              {thread.locked ? "Unlock" : "Lock"}
            </button>
            <button className="btn btn-danger !px-3 !py-1.5 text-xs" onClick={() => void moderate("delete")}>
              Delete
            </button>
          </div>
        )}
      </header>

      <ul className="space-y-3">
        {posts.map((post, index) => (
          <motion.li
            key={post.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.4 }}
            className="card p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#191920] pb-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#33161a] bg-[#101015] text-[11px] font-bold text-[#ff6b6b]">
                  {post.authorName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{post.authorName}</p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {roleLabel((post.authorRole as "member") ?? "member")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tag tone={ROLE_TONE[post.authorRole] ?? "default"}>{post.authorRole}</Tag>
                <span className="text-[10px] text-zinc-600">{timeAgo(post.createdAt)}</span>
              </div>
            </div>
            {renderMarkup(post.body)}
          </motion.li>
        ))}
      </ul>

      {thread.locked && !canModerate ? (
        <Notice kind="info">This thread is locked. New replies are disabled.</Notice>
      ) : (
        <Panel title="Reply">
          <form onSubmit={reply} className="space-y-3">
            <RichEditor value={body} onChange={setBody} placeholder="Write a reply…" minRows={5} />
            <button className="btn btn-primary" disabled={busy || body.trim().length < 2}>
              {busy ? <Spinner /> : null} Post reply
            </button>
          </form>
        </Panel>
      )}
    </div>
  );
}
