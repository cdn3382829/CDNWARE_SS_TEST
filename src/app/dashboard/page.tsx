import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { announcements, executionLogs, games, userBadges } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { tierLabel, roleLabel } from "@/lib/permissions";
import { StatCard } from "@/components/ui";
import { BADGE_META, formatNumber } from "@/lib/format";
import { Bolt, Gauge, ShieldAlert, CalendarClock, Flame } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const badgeRows = await db
    .select({ code: userBadges.code })
    .from(userBadges)
    .where(eq(userBadges.userId, user.id));
  const badgeCodes = new Set(badgeRows.map((row) => row.code));
  if (user.role !== "member") badgeCodes.add("staff");
  if (user.role === "owner") badgeCodes.add("founder");
  if (user.tier === "standard") badgeCodes.add("customer");
  if (user.tier === "premium") badgeCodes.add("premium");

  const [gameCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(games)
    .where(eq(games.approved, true));
  const [unread] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(announcements);
  const recentExec = await db
    .select({
      id: executionLogs.id,
      gameName: executionLogs.gameName,
      createdAt: executionLogs.createdAt,
      outcome: executionLogs.outcome,
    })
    .from(executionLogs)
    .where(eq(executionLogs.userId, user.id))
    .orderBy(desc(executionLogs.createdAt))
    .limit(6);

  const accountAgeDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86_400_000),
  );
  const badges = [...badgeCodes].filter((code) => BADGE_META[code]);

  return (
    <div className="space-y-6">
      <section className="card anim-fade-up scanline relative overflow-hidden p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {roleLabel(user.role)} · {tierLabel(user.tier)}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Welcome back, <span className="text-[#ff2d2d]">{user.username}</span>
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
              {user.status === "active"
                ? `Your account is in good standing. ${formatNumber(gameCount?.count ?? 0)} supported games are currently available to you.`
                : `Account status: ${user.status}. ${user.suspensionReason ?? ""}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/games" className="btn btn-primary">
              <Bolt size={15} /> Open executor
            </Link>
            <Link href="/dashboard/store" className="btn btn-ghost">
              Upgrade
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Account status"
          value={tierLabel(user.tier)}
          hint={`${roleLabel(user.role)} · ${user.status}`}
          icon={<Gauge size={16} />}
          accent
        />
        <StatCard
          label="Scripts executed"
          value={formatNumber(user.scriptsExecuted)}
          hint="Lifetime payload runs"
          icon={<Bolt size={16} />}
        />
        <StatCard
          label="Strikes"
          value={user.strikes}
          hint={user.strikes >= 3 ? "At limit — next step is a freeze" : "3 strikes = suspension"}
          icon={<ShieldAlert size={16} />}
        />
        <StatCard
          label="Account age"
          value={`${accountAgeDays}d`}
          hint={`Joined ${new Date(user.createdAt).toLocaleDateString()}`}
          icon={<CalendarClock size={16} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card anim-fade-up p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Badges</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {badges.length === 0 && (
              <p className="text-xs text-zinc-500">
                No badges yet — execute your first payload to unlock one.
              </p>
            )}
            {badges.map((code, index) => (
              <div
                key={code}
                className="card card-hover anim-pop flex items-center gap-3 px-3 py-2"
                style={{ animationDelay: `${index * 70}ms` }}
                title={BADGE_META[code]?.name}
              >
                <span className="text-xl">{BADGE_META[code]?.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-white">{BADGE_META[code]?.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Unlocked</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card anim-fade-up delay-2 p-5">
          <h2 className="text-sm font-semibold text-white">Recent activity</h2>
          <ul className="mt-4 space-y-2">
            {recentExec.length === 0 && (
              <li className="text-xs text-zinc-500">No executions logged yet.</li>
            )}
            {recentExec.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#1d1d24] bg-[#0b0b0f] px-3 py-2"
              >
                <span className="truncate text-xs text-zinc-300">{row.gameName || "Unknown game"}</span>
                <span
                  className={`shrink-0 text-[10px] uppercase tracking-wider ${
                    row.outcome === "executed" ? "text-emerald-400" : "text-[#ff6b6b]"
                  }`}
                >
                  {row.outcome.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Flame size={13} className="text-[#ff5a5a]" /> {formatNumber(unread?.count ?? 0)}{" "}
            announcements posted
          </p>
        </section>
      </div>
    </div>
  );
}
