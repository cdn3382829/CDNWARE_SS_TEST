"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, EmptyState, Notice, Panel, Spinner, Tag, useToast } from "@/components/ui";
import { timeAgo } from "@/lib/format";

type Announcement = {
  id: number;
  title: string;
  body: string;
  authorName: string;
  pinned: boolean;
  createdAt: string;
  read: boolean;
};

export function AnnouncementsClient({ canPost }: { canPost: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const { toast, push, clear } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await api<{ announcements: Announcement[] }>("/api/announcements");
      setItems(data.announcements);
      setOpen((prev) =>
        prev.length ? prev : data.announcements.filter((a) => !a.read).map((a) => a.id).slice(0, 1),
      );
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not load announcements.");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (item: Announcement) => {
    setOpen((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
    if (!item.read) {
      try {
        await api(`/api/announcements?id=${item.id}`, { method: "PATCH" });
        setItems((prev) => prev.map((a) => (a.id === item.id ? { ...a, read: true } : a)));
      } catch {
        /* non-fatal */
      }
    }
  };

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      await api("/api/announcements", {
        method: "POST",
        body: JSON.stringify({ title, body, pinned }),
      });
      setTitle("");
      setBody("");
      setPinned(false);
      push("success", "Announcement published.");
      await load();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setPosting(false);
    }
  };

  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="space-y-5">
      {toast && <Notice kind={toast.kind} onClose={clear}>{toast.text}</Notice>}

      {canPost && (
        <Panel title="Post a global announcement" subtitle="Visible to every CDN_SS user.">
          <form onSubmit={post} className="space-y-3">
            <input
              className="input"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={140}
            />
            <textarea
              className="input min-h-[120px] font-mono text-[12px]"
              placeholder="Body — supports **bold**, *italic*, `code`, ```code blocks``` and [img]url[/img]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={3}
              maxLength={8000}
            />
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="h-4 w-4 accent-[#ff2d2d]"
                />
                Pin to top
              </label>
              <button className="btn btn-primary" disabled={posting}>
                {posting ? <Spinner /> : null} Publish
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel
        title="Announcements"
        subtitle={unread > 0 ? `${unread} unread` : "You are all caught up."}
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="📢" title="No announcements yet" hint="Staff posts will show up here." />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const expanded = open.includes(item.id);
              return (
                <li
                  key={item.id}
                  className={`card anim-fade-up overflow-hidden ${
                    item.read ? "" : "border-[#4a1414]"
                  }`}
                >
                  <button
                    onClick={() => void toggle(item)}
                    className="flex w-full items-start justify-between gap-4 p-4 text-left transition hover:bg-[#101015]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5">
                        {!item.read && (
                          <span className="anim-blink inline-block h-2 w-2 rounded-full bg-[#ff2d2d]" />
                        )}
                        {item.read && <span className="inline-block h-2 w-2 rounded-full bg-[#2a2a33]" />}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {item.authorName} · {timeAgo(item.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {item.pinned && <Tag tone="red">Pinned</Tag>}
                      <span className="text-zinc-600">{expanded ? "−" : "+"}</span>
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden border-t border-[#1a1a21]"
                      >
                        <pre className="whitespace-pre-wrap break-words p-4 font-sans text-[13px] leading-relaxed text-zinc-300">
                          {item.body}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
