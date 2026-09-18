"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Play, RotateCcw, Save, FolderOpen, Trash2, Terminal } from "lucide-react";
import { api, Notice, Spinner, Tag, useToast } from "@/components/ui";

type SavedScript = { id: number; name: string; content: string; updatedAt: string };

const SAMPLE = `-- CDN_SS server-side payload
local Players = game:GetService("Players")
local ServerScriptService = game:GetService("ServerScriptService")

print("[CDN_SS] attached to", game.PlaceId)

for _, player in ipairs(Players:GetPlayers()) do
    local character = player.Character
    if character and character:FindFirstChildOfClass("Humanoid") then
        character:FindFirstChildOfClass("Humanoid").WalkSpeed = 32
    end
end

print("[CDN_SS] payload finished")`;

export function Executor({
  game,
  server,
}: {
  game: { id: number; name: string; placeId: string };
  server: { id: string; players: number; maxPlayers: number; region: string };
}) {
  const [script, setScript] = useState(SAMPLE);
  const [saved, setSaved] = useState<SavedScript[]>([]);
  const [name, setName] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "running" | "executed" | "blocked">("idle");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [openLibrary, setOpenLibrary] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const { toast, push, clear } = useToast();

  const loadLibrary = async () => {
    try {
      const data = await api<{ scripts: SavedScript[] }>("/api/scripts");
      setSaved(data.scripts);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not load saved scripts.");
    }
  };

  useEffect(() => {
    void loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [output]);

  const execute = async () => {
    setBusy(true);
    setState("running");
    setOutput([`[CDN_SS] compiling ${script.length} bytes …`]);
    try {
      const data = await api<{
        status: string;
        message?: string;
        output?: string[];
      }>("/api/execute", {
        method: "POST",
        body: JSON.stringify({ gameId: game.id, serverId: server.id, script }),
      });
      if (data.status === "blocked") {
        setState("blocked");
        setMessage(data.message ?? "Script blocked by the filter.");
        setOutput((prev) => [...prev, `[CDN_SS] blocked: ${data.message ?? ""}`]);
      } else {
        setState("executed");
        setMessage("");
        setOutput((prev) => [...prev, ...(data.output ?? []), "[CDN_SS] done"]);
      }
    } catch (err) {
      setState("blocked");
      setMessage(err instanceof Error ? err.message : "Execution failed.");
      setOutput((prev) => [...prev, `[CDN_SS] error: ${err instanceof Error ? err.message : ""}`]);
    } finally {
      setBusy(false);
    }
  };

  const resetEditor = () => {
    setScript("");
    setOutput([]);
    setState("idle");
    setMessage("");
  };

  const save = async () => {
    const scriptName = name.trim() || `payload-${new Date().toISOString().slice(11, 19)}`;
    try {
      await api("/api/scripts", {
        method: "POST",
        body: JSON.stringify({ name: scriptName, content: script }),
      });
      setName("");
      push("success", `Saved "${scriptName}".`);
      await loadLibrary();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not save the script.");
    }
  };

  const remove = async (id: number) => {
    try {
      await api(`/api/scripts/${id}`, { method: "DELETE" });
      setSaved((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not delete the script.");
    }
  };

  return (
    <div className="space-y-4">
      {toast && <Notice kind={toast.kind} onClose={clear}>{toast.text}</Notice>}

      <div className="card anim-fade-up overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a21] bg-[#0c0c10] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Terminal size={15} className="text-[#ff5a5a]" />
            <span className="text-xs font-semibold text-white">Executor</span>
            <Tag>{game.name}</Tag>
            <Tag tone="blue">
              {server.id} · {server.players}/{server.maxPlayers}
            </Tag>
          </div>
          <AnimatePresence mode="wait">
            {state === "executed" && (
              <motion.span
                key="executed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 rounded-full border border-emerald-700/60 bg-emerald-950/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300"
              >
                <Check size={12} /> Executed
              </motion.span>
            )}
            {state === "blocked" && (
              <motion.span
                key="blocked"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 rounded-full border border-[#611414] bg-[#1b0707] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#ff8f8f]"
              >
                Blocked
              </motion.span>
            )}
            {state === "running" && (
              <motion.span
                key="running"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-400"
              >
                <Spinner /> Running
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
          <div className="border-[#1a1a21] p-3 lg:border-r">
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              spellCheck={false}
              className="h-[340px] w-full resize-none rounded-lg border border-[#23232b] bg-[#08080b] p-3 font-mono text-[12.5px] leading-relaxed text-[#e4e4ea] outline-none transition focus:border-[#ff2d2d] focus:shadow-[0_0_0_3px_rgba(255,45,45,0.12)]"
              placeholder="-- write your server-side payload here"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={execute} disabled={busy || script.trim().length === 0} className="btn btn-primary">
                {busy ? <Spinner /> : <Play size={14} />} Execute
              </button>
              <button onClick={resetEditor} className="btn btn-danger">
                <RotateCcw size={14} /> Clear
              </button>
              <div className="ml-auto flex items-center gap-2">
                <input
                  className="input !w-40 !py-1.5 text-xs"
                  placeholder="script name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={64}
                />
                <button onClick={save} className="btn btn-ghost !py-1.5 text-xs">
                  <Save size={13} /> Save
                </button>
                <button
                  onClick={() => setOpenLibrary((v) => !v)}
                  className="btn btn-ghost !py-1.5 text-xs"
                >
                  <FolderOpen size={13} /> Load
                </button>
              </div>
            </div>
            {message && (
              <div className="mt-3">
                <Notice kind={state === "blocked" ? "error" : "success"}>{message}</Notice>
              </div>
            )}
          </div>

          <div className="p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Saved scripts ({saved.length})
            </p>
            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {saved.length === 0 && (
                <p className="text-[11px] leading-relaxed text-zinc-600">
                  Nothing saved yet. Name a payload and hit <b>Save</b> to keep it in your library.
                </p>
              )}
              {saved.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between gap-2 rounded-lg border border-[#1d1d24] bg-[#0b0b0f] px-2.5 py-2 transition hover:border-[#4a1414]"
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setScript(item.content);
                      setOpenLibrary(true);
                      push("info", `Loaded "${item.name}".`);
                    }}
                  >
                    <p className="truncate text-[11px] font-semibold text-zinc-200">{item.name}</p>
                    <p className="text-[10px] text-zinc-600">{item.content.split("\n").length} lines</p>
                  </button>
                  <button
                    onClick={() => void remove(item.id)}
                    className="text-zinc-600 opacity-0 transition group-hover:opacity-100 hover:text-[#ff6b6b]"
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[#1a1a21] bg-[#08080b] p-3">
          <div
            ref={consoleRef}
            className="h-[130px] overflow-y-auto rounded-lg border border-[#191920] bg-black/60 p-3 font-mono text-[11.5px] leading-relaxed text-[#9fe6a8]"
          >
            {output.length === 0 ? (
              <p className="text-zinc-600">-- console idle. press Execute to run the payload.</p>
            ) : (
              output.map((line, index) => (
                <motion.p
                  key={`${index}-${line.slice(0, 12)}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  {line}
                </motion.p>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Every executed payload is logged and reviewed by the moderation team. Scripts matching the
        CDN_SS filter are blocked and can auto-suspend or auto-blacklist your account.
      </p>
    </div>
  );
}
