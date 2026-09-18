"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Notice, Spinner } from "@/components/ui";

export function OnboardingAccept({
  step,
  version,
  nextLabel,
}: {
  step: "tos" | "rules";
  version: number;
  nextLabel: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ next: string }>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({ step, version }),
      });
      router.push(data.next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your answer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#23232b] bg-[#0b0b0f] p-4 transition hover:border-[#4a1414]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#ff2d2d]"
        />
        <span className="text-xs leading-relaxed text-zinc-300">
          I have read and I accept the {step === "tos" ? "Terms of Service" : "community rules"}. I
          understand that breaking them leads to strikes, suspensions, freezes or a permanent
          blacklist.
        </span>
      </label>

      {error && <Notice kind="error">{error}</Notice>}

      <button onClick={accept} disabled={!checked || busy} className="btn btn-primary w-full">
        {busy ? <Spinner /> : null}
        {nextLabel}
      </button>
    </div>
  );
}
