"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Notice, Spinner } from "@/components/ui";

export function RulesAccept({ version }: { version: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/onboarding", { method: "POST", body: JSON.stringify({ step: "rules", version }) });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && <Notice kind="error">{error}</Notice>}
      <button onClick={accept} disabled={busy} className="btn btn-primary w-full">
        {busy ? <Spinner /> : null} I have read the updated rules
      </button>
    </div>
  );
}
