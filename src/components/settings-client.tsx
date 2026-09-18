"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Notice, Panel, Spinner, useToast } from "@/components/ui";

type Props = {
  initial: {
    username: string;
    email: string;
    bio: string;
    avatarUrl: string;
  };
};

export function SettingsClient({ initial }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const { toast, push, clear } = useToast();

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api<{ reauth?: boolean }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ username, bio, avatarUrl }),
      });
      push("success", data.reauth ? "Saved. Please log in again." : "Profile updated.");
      router.refresh();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      push("success", "Password changed. All sessions were logged out.");
      setTimeout(() => router.push("/login"), 1600);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {toast && <Notice kind={toast.kind} onClose={clear}>{toast.text}</Notice>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Panel title="Profile" subtitle="How other users see you on the forum.">
            <form onSubmit={saveProfile} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Username
                </span>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[A-Za-z0-9_]+"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Bio
                </span>
                <textarea
                  className="input min-h-[90px]"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                />
                <span className="mt-1 block text-right text-[10px] text-zinc-600">{bio.length}/280</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Profile picture (https image URL)
                </span>
                <input
                  className="input"
                  type="url"
                  placeholder="https://i.imgur.com/…"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  maxLength={600}
                />
              </label>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? <Spinner /> : null} Save profile
              </button>
            </form>
          </Panel>

          <Panel title="Change password" subtitle="Changing it logs out every session.">
            <form onSubmit={changePassword} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Current password
                </span>
                <input
                  className="input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  New password
                </span>
                <input
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <span className="mt-1 block text-[11px] text-zinc-600">
                  Minimum 8 characters with a letter and a number.
                </span>
              </label>
              <button className="btn btn-danger" disabled={pwBusy}>
                {pwBusy ? <Spinner /> : null} Update password
              </button>
            </form>
          </Panel>
        </div>

        <Panel title="Account" subtitle="Immutable identifiers">
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-zinc-500">Email on file</dt>
              <dd className="mt-0.5 break-all text-zinc-200">{initial.email}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Password storage</dt>
              <dd className="mt-0.5 text-zinc-200">scrypt (N=16384) with per-user salt</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Avatar preview</dt>
              <dd className="mt-2 flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-[#26262e] bg-[#101015] text-xl font-bold text-[#ff6b6b]">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  username.slice(0, 2).toUpperCase()
                )}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
