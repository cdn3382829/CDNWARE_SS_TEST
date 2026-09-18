"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, EmptyState, Notice, Panel, Spinner, Tag, useToast } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { RichEditor } from "@/components/rich-editor";

type Thread = {
  id: number;
  title: string;
  authorName: string;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  views: number;
  lastPostAt: string;
  createdAt: string;
};

const SECTIONS: Record<string, { label: string; icon: string; blurb: string }> = {
  scripts: { label: "Scripts", icon: "📜", blurb: "Share and discuss server-side scripts." },
  support: { label: "Support", icon: "🛠️", blurb: "Need help? Ask the team here." },
  suggestions: { label: "Suggestions", icon: "💡", blurb: "Ideas and feature requests." },
  talk: { label: "Just Talk", icon: "💬", blurb: "Off-topic discussion lounge." },
};

export function ForumClient({ section }: { section: string }) {
  const meta = SECTIONS[section] ?? { label: "Forum", icon: "💬", blurb: "" };
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, push, clear } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ threads: Thread[] }>(`/api/forum/threads?section=${section}`);
      setThreads(data.threads);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not load threads.");
    } finally {
      setLoading(false);
    }
  }, [section, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api<{ id: number }>("/api/forum/threads", {
        method: "POST",
        body: JSON.stringify({ section, title, body }),
      });
      setTitle("");
      setBody("");
      setComposing(false);
      push("success", "Thread posted.");
      window.location.href = `/dashboard/forum/thread/${data.id}`;
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not post the thread.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {toast && <Notice kind={toast.kind} onClose={clear}>{toast.text}</Notice>}

      <header className="card anim-fade-up flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <h1 className="text-base font-bold text-white">{meta.label}</h1>
            <p className="text-[11px] text-zinc-500">{meta.blurb}</p>
          </div>
        </div>
        <button className="btn btn-primary !py-2 text-xs" onClick={() => setComposing((v) => !v)}>
          {composing ? "Cancel" : "New thread"}
        </button>
      </header>

      <AnimatePresence>
        {composing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Panel title="Start a thread">
              <form onSubmit={submit} className="space-y-3">
                <input
                  className="input"
                  placeholder="Thread title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  minLength={3}
                  maxLength={120}
                />
                <RichEditor value={body} onChange={setBody} placeholder="Write your post…" minRows={8} />
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? <Spinner /> : null} Post thread
                </button>
              </form>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      <Panel title={`Threads (${threads.length})`}>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : threads.length === 0 ? (
          <EmptyState icon="💬" title="No threads yet" hint="Be the first to post in this section." />
        ) : (
          <ul className="space-y-2">
            {threads.map((thread, index) => (
              <motion.li
                key={thread.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <Link
                  href={`/dashboard/forum/thread/${thread.id}`}
                  className="card card-hover flex flex-wrap items-center justify-between gap-3 p-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {thread.pinned && <Tag tone="red">Pinned</Tag>}
                      {thread.locked && <Tag tone="amber">Locked</Tag>}
                      <p className="truncate text-sm font-semibold text-white">{thread.title}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      by {thread.authorName} · {timeAgo(thread.createdAt)} · {thread.views} views
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag>{thread.replyCount} replies</Tag>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                      {timeAgo(thread.lastPostAt)}
                    </span>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
