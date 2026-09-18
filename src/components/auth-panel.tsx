"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Notice, Spinner } from "@/components/ui";

export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const payload =
        mode === "signup" ? { username, email, password } : { identifier, password };
      const data = await api<{ redirect: string }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(data.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "login" ? (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Username or email
          </span>
          <input
            className="input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={254}
          />
        </label>
      ) : (
        <>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Username
            </span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]+"
              title="Letters, numbers and underscores only"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Email
            </span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
        </>
      )}

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Password
        </span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 8 : 1}
          maxLength={128}
        />
        {mode === "signup" && (
          <span className="mt-1 block text-[11px] text-zinc-600">
            Minimum 8 characters, must include a letter and a number.
          </span>
        )}
      </label>

      {mode === "signup" && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Confirm password
          </span>
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
        </label>
      )}

      {error && <Notice kind="error">{error}</Notice>}

      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? <Spinner /> : null}
        {mode === "login" ? "Log in" : "Create account"}
      </button>

      <p className="text-center text-xs text-zinc-500">
        {mode === "login" ? (
          <>
            No account yet?{" "}
            <Link href="/signup" className="text-[#ff5a5a] hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="text-[#ff5a5a] hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
