"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/* --------------------------- Fetch helper --------------------------- */

export type ApiResult<T> = T & { ok: true };

export async function api<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    credentials: "same-origin",
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const data = (payload ?? {}) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  }
  return data as ApiResult<T>;
}

/* --------------------------- Primitives --------------------------- */

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`anim-spin inline-block h-4 w-4 rounded-full border-2 border-[#3a1d1d] border-t-[#ff2d2d] ${className}`}
    />
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card anim-fade-up p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-wide text-white">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`card card-hover anim-fade-up scanline relative overflow-hidden p-4 ${
        accent ? "border-[#4a1414]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
        {icon && <span className="text-[#ff5a5a]">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export function Tag({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "red" | "green" | "amber" | "blue";
}) {
  const tones: Record<string, string> = {
    default: "border-[#26262e] bg-[#101015] text-zinc-400",
    red: "border-[#5a1414] bg-[#1b0808] text-[#ff6b6b]",
    green: "border-[#14532d] bg-[#04170c] text-emerald-400",
    amber: "border-[#5c4310] bg-[#1a1204] text-amber-400",
    blue: "border-[#1e3a8a] bg-[#050b1c] text-sky-400",
  };
  return <span className={`tag ${tones[tone]}`}>{children}</span>;
}

export function Notice({
  kind,
  children,
  onClose,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
  onClose?: () => void;
}) {
  const tones = {
    error: "border-[#5a1414] bg-[#1b0707] text-[#ff9b9b]",
    success: "border-[#14532d] bg-[#04170c] text-emerald-300",
    info: "border-[#26262e] bg-[#101015] text-zinc-300",
  } as const;
  return (
    <div
      className={`anim-pop flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${tones[kind]}`}
    >
      <div className="leading-relaxed">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-current/70 hover:text-current" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon = "🕳️", title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="anim-fade-in flex flex-col items-center justify-center rounded-xl border border-dashed border-[#22222a] py-12 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-zinc-300">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="anim-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div
        className={`anim-pop card my-10 w-full ${wide ? "max-w-3xl" : "max-w-lg"} border-[#2a2a33] p-5`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 transition hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --------------------------- Helpers --------------------------- */

export function useInterval(callback: () => void, delay: number | null) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => ref.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function useToast() {
  const [toast, setToast] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(
    null,
  );
  const push = useCallback((kind: "error" | "success" | "info", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4500);
  }, []);
  return { toast, push, clear: () => setToast(null) };
}

