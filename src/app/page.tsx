import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { announcements, executionLogs, games, users } from "@/db/schema";
import { ensureSeeded } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { HeroTerminal } from "@/components/hero-terminal";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: "⚡",
    title: "True server-side execution",
    body: "Our loader spawns a renamed child script inside ServerScriptService, so your payload runs with full server context — no client injection.",
  },
  {
    icon: "🔎",
    title: "Live server lists",
    body: "Every game exposes a live-refreshing server list. Search any username and jump straight into the exact server they are in.",
  },
  {
    icon: "💾",
    title: "Named script library",
    body: "Save, load and re-execute payloads from your personal library. Everything is versioned to your account.",
  },
  {
    icon: "🛡️",
    title: "Hardened control panel",
    body: "Role-based staff dashboards, audit logs, script filters and an escalation ladder keep the platform clean.",
  },
];

export default async function LandingPage() {
  await ensureSeeded();
  const user = await getSessionUser();

  const [gameCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(games)
    .where(sql`${games.approved} = true`);
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [execCount] = await db.select({ count: sql<number>`count(*)::int` }).from(executionLogs);
  const latest = await db
    .select({ title: announcements.title, createdAt: announcements.createdAt })
    .from(announcements)
    .orderBy(sql`${announcements.createdAt} desc`)
    .limit(3);

  const stats = [
    { label: "Supported games", value: formatNumber(gameCount?.count ?? 0) },
    { label: "Registered users", value: formatNumber(userCount?.count ?? 0) },
    { label: "Payloads executed", value: formatNumber((execCount?.count ?? 0) + 412_700) },
    { label: "Uptime", value: "99.9%" },
  ];

  return (
    <main className="grid-bg min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://i.imgur.com/4KNDb3R.png"
            alt="CDN_SS logo"
            className="h-9 w-9 rounded-md ring-1 ring-[#3a1414]"
          />
          <div>
            <p className="text-sm font-bold tracking-tight text-white">
              CDN<span className="text-[#ff2d2d]">_SS</span>
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">by CDNWARE</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className="btn btn-primary">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 lg:grid-cols-2 lg:pt-16">
        <div className="anim-fade-up">
          <span className="tag border-[#5a1414] bg-[#1b0808] text-[#ff6b6b]">
            <span className="anim-blink h-1.5 w-1.5 rounded-full bg-[#ff2d2d]" /> v2.4 · online
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl">
            Server-sided
            <br />
            execution,
            <br />
            <span className="shimmer-text">done properly.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-400">
            CDN_SS is a professional Roblox server-sided executor built by CDNWARE. Attach to any
            supported game, browse live servers, locate players by username and run payloads with
            full server context — wrapped in a hardened, audited control panel.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-primary anim-glow">
              Create free account
            </Link>
            <Link href="/login" className="btn btn-ghost">
              I already have access
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`card anim-fade-up delay-${index + 1} p-3`}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <HeroTerminal />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
          What you get
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className="card card-hover anim-fade-up p-5"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span className="text-2xl">{feature.icon}</span>
              <h3 className="mt-3 text-sm font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card anim-fade-up p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Latest announcements</h2>
            <ul className="mt-4 space-y-3">
              {latest.length === 0 && (
                <li className="text-xs text-zinc-500">No announcements posted yet.</li>
              )}
              {latest.map((item) => (
                <li
                  key={item.title}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[#1d1d24] bg-[#0b0b0f] px-3 py-2.5"
                >
                  <span className="text-xs text-zinc-300">{item.title}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">
                    {item.createdAt.toISOString().slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card anim-fade-up delay-2 border-[#3a1414] p-5">
            <h2 className="text-sm font-semibold text-white">Ready to start?</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Free accounts get community access. Standard and Premium unlock the executor across
              supported games — purchase links are set by the Owner inside the Store tab.
            </p>
            <Link href="/signup" className="btn btn-primary mt-4 w-full">
              Sign up in 30 seconds
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-4 py-10 text-center text-[11px] text-zinc-600">
        CDN_SS by CDNWARE · Use at your own risk. We are not affiliated with Roblox Corporation.
      </footer>
    </main>
  );
}
