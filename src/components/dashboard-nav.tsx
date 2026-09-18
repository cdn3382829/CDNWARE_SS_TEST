"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, useInterval } from "@/components/ui";
import { roleLabel, tierLabel, type Role, type Tier } from "@/lib/permissions";

type MePayload = {
  user: {
    username: string;
    role: Role;
    tier: Tier;
    avatarUrl: string;
  } | null;
  unreadAnnouncements: number;
  rulesUpdated: boolean;
  pendingReviews: number;
};

const LINKS = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/dashboard/announcements", label: "Announcements", icon: "📢", badge: "announcements" },
  { href: "/dashboard/store", label: "Store", icon: "🛒" },
  { href: "/dashboard/games", label: "Games", icon: "🎮" },
  { href: "/dashboard/forum", label: "Forum", icon: "💬" },
  { href: "/dashboard/rules", label: "Rules", icon: "📕", badge: "rules" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export function DashboardNav({
  initial,
}: {
  initial: { username: string; role: Role; tier: Tier; avatarUrl: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MePayload>({
    user: initial,
    unreadAnnouncements: 0,
    rulesUpdated: false,
    pendingReviews: 0,
  });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const data = await api<MePayload>("/api/me");
      setMe({
        user: data.user ?? initial,
        unreadAnnouncements: data.unreadAnnouncements ?? 0,
        rulesUpdated: data.rulesUpdated ?? false,
        pendingReviews: data.pendingReviews ?? 0,
      });
    } catch {
      /* silent — the next poll retries */
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useInterval(() => void refresh(), 20_000);

  const isStaff = me.user?.role !== "member";

  const logout = async () => {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const badgeFor = (key?: string) => {
    if (key === "announcements" && me.unreadAnnouncements > 0) return me.unreadAnnouncements;
    if (key === "rules" && me.rulesUpdated) return "!";
    return null;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#17171d] bg-[#07070999] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://i.imgur.com/4KNDb3R.png"
            alt="CDN_SS"
            className="h-8 w-8 rounded-md ring-1 ring-[#3a1414]"
          />
          <span className="text-sm font-bold tracking-tight text-white">
            CDN<span className="text-[#ff2d2d]">_SS</span>
          </span>
        </Link>

        <nav className="order-3 flex w-full flex-wrap items-center gap-1 md:order-none md:w-auto">
          {LINKS.map((link) => {
            const active =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href);
            const badge = badgeFor(link.badge);
            return (
              <Link
                key={link.href}
                href={link.href}
                data-active={active}
                className="nav-link flex items-center gap-1.5"
              >
                <span className="text-[13px]">{link.icon}</span>
                {link.label}
                {badge !== null && (
                  <span className="anim-blink ml-0.5 rounded-full bg-[#ff2d2d] px-1.5 py-[1px] text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
          {isStaff && (
            <Link href="/staff" data-active={pathname.startsWith("/staff")} className="nav-link flex items-center gap-1.5">
              <span className="text-[13px]">🛡️</span>
              Staff
              {me.pendingReviews > 0 && (
                <span className="anim-blink ml-0.5 rounded-full bg-[#ff2d2d] px-1.5 py-[1px] text-[10px] font-bold text-white">
                  {me.pendingReviews}
                </span>
              )}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold text-white">{me.user?.username}</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              {roleLabel(me.user?.role ?? "member")} · {tierLabel(me.user?.tier ?? "none")}
            </p>
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#33161a] bg-[#101015] text-xs font-bold text-[#ff6b6b]"
            title={me.user?.username}
          >
            {me.user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (me.user?.username ?? "?").slice(0, 2).toUpperCase()
            )}
          </div>
          <button onClick={logout} disabled={busy} className="btn btn-ghost !px-3 !py-1.5 text-xs">
            {busy ? "…" : "Log out"}
          </button>
        </div>
      </div>
    </header>
  );
}
