"use client";

import { useRef, useState } from "react";
import { renderMarkup } from "@/lib/markup";
import { api, Spinner } from "@/components/ui";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
};

export function RichEditor({ value, onChange, placeholder, minRows = 7 }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api<{ id: string }>("/api/images", { method: "POST", body: form });
      onChange(`${value}${value.endsWith("\n") || value === "" ? "" : "\n"}[img]${data.id}[/img]\n`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const tools = [
    { label: "B", title: "Bold", action: () => wrap("**") },
    { label: "I", title: "Italic", action: () => wrap("*") },
    { label: "U", title: "Underline", action: () => wrap("__") },
    { label: "S", title: "Strikethrough", action: () => wrap("~~") },
    { label: "</>", title: "Inline code", action: () => wrap("`") },
    { label: "{ }", title: "Code block", action: () => wrap("```\n", "\n```") },
  ];

  return (
    <div className="rounded-xl border border-[#23232b] bg-[#0a0a0d] p-2 transition focus-within:border-[#ff2d2d]">
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            onClick={tool.action}
            className="rounded-md border border-[#23232b] bg-[#101015] px-2 py-1 font-mono text-[11px] text-zinc-400 transition hover:border-[#4a1414] hover:text-white"
          >
            {tool.label}
          </button>
        ))}
        <label className="cursor-pointer rounded-md border border-[#23232b] bg-[#101015] px-2 py-1 text-[11px] text-zinc-400 transition hover:border-[#4a1414] hover:text-white">
          {uploading ? <Spinner className="h-3 w-3" /> : "🖼️"} Image
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className={`ml-auto rounded-md border px-2 py-1 text-[11px] transition ${
            preview
              ? "border-[#4a1414] bg-[#1b0808] text-[#ff8f8f]"
              : "border-[#23232b] bg-[#101015] text-zinc-400 hover:text-white"
          }`}
        >
          {preview ? "Editing off" : "Preview"}
        </button>
      </div>

      {preview ? (
        <div className="min-h-[120px] rounded-lg border border-[#191920] bg-[#08080b] p-3">
          {renderMarkup(value || "_nothing to preview_")}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-transparent bg-transparent p-2 font-mono text-[12.5px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600"
        />
      )}

      {error && <p className="px-2 pb-1 text-[11px] text-[#ff8f8f]">{error}</p>}
      <p className="px-2 pb-1 text-[10px] text-zinc-600">
        **bold** · *italic* · __underline__ · ~~strike~~ · `code` · ```code block``` · [img]url[/img]
        · max 2 MB images
      </p>
    </div>
  );
}
