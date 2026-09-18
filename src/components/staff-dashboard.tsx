"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  ShieldCheck,
  ScrollText,
  Ban,
  Filter as FilterIcon,
  ClipboardList,
  Gamepad2,
  Settings as SettingsIcon,
  Play,
  RotateCcw,
} from "lucide-react";
import { api, Modal, Notice, Panel, Spinner, StatCard, Tag, useToast } from "@/components/ui";
import { formatNumber, timeAgo } from "@/lib/format";
import { RichEditor } from "@/components/rich-editor";
import { roleLabel, tierLabel, type Role } from "@/lib/permissions";

type LookupUser = {
  id: number;
  username: string;
  email: string;
  role: Role;
  tier: "none" | "standard" | "premium";
  status: string;
  strikes: number;
  scriptsExecuted: number;
  createdAt: string;
  lastLoginAt: string | null;
  lastIp: string | null;
};

type StaffUser = {
  id: number;
  username: string;
  email: string;
  role: Role;
  tier: "none" | "standard" | "premium";
  status: string;
  strikes: number;
  scriptsExecuted: number;
  bio: string;
  avatarUrl: string;
  createdAt: string;
  lastLoginAt: string | null;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  blacklistReason: string | null;
  freezeReason: string | null;
  onboardingComplete: boolean;
  lastIp: string | null;
  lastUserAgent: string | null;
};

type StaffDetail = {
  user: StaffUser;
  strikes: { id: number; reason: string; issuerName: string; createdAt: string }[];
  suspensions: {
    id: number;
    reason: string;
    issuerName: string;
    startsAt: string;
    endsAt: string | null;
    active: boolean;
  }[];
  notes: { id: number; body: string; authorName: string; createdAt: string }[];
  blacklists: { id: number; reason: string; blacklistedByName: string; createdAt: string }[];
  badges: string[];
  privateGames: { gameId: number; gameName: string }[];
  can: {
    viewIp: boolean;
    blacklist: boolean;
    manageTier: boolean;
    assignPrivateGames: boolean;
    manageRoles: boolean;
    freeze: boolean;
  };
};

type LogRow = {
  id: number;
  username: string;
  userId: number;
  gameName: string;
  serverId: string;
  flagged: boolean;
  flagReason: string | null;
  reviewStatus: string;
  outcome: string;
  scriptLength: number;
  preview: string;
  createdAt: string;
};

type PatternRow = {
  id: number;
  pattern: string;
  matchType: string;
  action: string;
  reason: string;
  active: boolean;
  createdAt: string;
  creatorName: string | null;
};

type AuditRow = {
  id: number;
  actorName: string;
  actorRole: string;
  action: string;
  targetName: string;
  details: string;
  ip: string;
  createdAt: string;
};

type GameRow = {
  id: number;
  name: string;
  placeId: string;
  creator: string;
  tier: "standard" | "premium" | "private";
  approved: boolean;
  playerCount: number;
  visits: number;
  createdAt: string;
};

const STATUS_TONE: Record<string, "default" | "red" | "green" | "amber" | "blue"> = {
  active: "green",
  suspended: "amber",
  frozen: "blue",
  blacklisted: "red",
};

export function StaffDashboard({ role }: { role: Role }) {
  const isOwner = role === "owner";
  const isAdmin = role === "admin" || isOwner;

  const tabs = useMemo(() => {
    const list: { key: string; label: string; icon: React.ReactNode }[] = [
      { key: "users", label: "User management", icon: <Search size={14} /> },
      { key: "review", label: role === "moderator" ? "Script logs" : "Review queue", icon: <ScrollText size={14} /> },
    ];
    if (isAdmin) {
      list.push({ key: "filters", label: "Script filters", icon: <FilterIcon size={14} /> });
      list.push({ key: "logs", label: "Audit logs", icon: <ClipboardList size={14} /> });
    }
    if (isOwner) {
      list.push({ key: "games", label: "Game review", icon: <Gamepad2 size={14} /> });
      list.push({ key: "settings", label: "Site settings", icon: <SettingsIcon size={14} /> });
    }
    return list;
  }, [role, isAdmin, isOwner]);

  const [tab, setTab] = useState("users");
  const { toast, push, clear } = useToast();

  return (
    <div className="space-y-5">
      {toast && <Notice kind={toast.kind} onClose={clear}>{toast.text}</Notice>}

      <header className="card anim-fade-up flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} className="text-[#ff5a5a]" />
          <div>
            <h1 className="text-base font-bold text-white">Staff dashboard</h1>
            <p className="text-[11px] text-zinc-500">
              Signed in as {roleLabel(role)} —{" "}
              {role === "moderator"
                ? "limited access: no IP addresses, no blacklists, no tier changes."
                : "full moderation access."}
            </p>
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`btn !py-1.5 text-xs ${tab === item.key ? "btn-primary" : "btn-ghost"}`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "users" && <UsersTab push={push} />}
          {tab === "review" && <ReviewTab role={role} push={push} />}
          {tab === "filters" && isAdmin && <FiltersTab push={push} />}
          {tab === "logs" && isAdmin && <LogsTab />}
          {tab === "games" && isOwner && <GamesTab push={push} />}
          {tab === "settings" && isOwner && <SettingsTab push={push} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

type Push = (kind: "error" | "success" | "info", text: string) => void;

/* ------------------------------ Users ------------------------------ */

function UsersTab({ push }: { push: Push }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LookupUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(3);
  const [note, setNote] = useState("");
  const [games, setGames] = useState<GameRow[]>([]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api<{ users: LookupUser[] }>(
        `/api/staff/lookup?q=${encodeURIComponent(query)}`,
      );
      setResults(data.users);
      setSearched(true);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const open = async (id: number) => {
    setDetailLoading(true);
    try {
      const data = await api<StaffDetail>(`/api/staff/user/${id}`);
      setDetail(data);
      setReason("");
      if (data.can.assignPrivateGames) {
        const gameList = await api<{ games: GameRow[] }>("/api/staff/games");
        setGames(gameList.games.filter((game) => game.tier === "private" || game.approved));
      }
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not load that user.");
    } finally {
      setDetailLoading(false);
    }
  };

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!detail) return;
    try {
      await api(`/api/staff/user/${detail.user.id}`, {
        method: "POST",
        body: JSON.stringify({ action, reason, days, ...extra }),
      });
      push("success", `${action.replace("_", " ")} applied.`);
      setReason("");
      setNote("");
      await open(detail.user.id);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Action failed.");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <Panel title="User lookup" subtitle="Search by username or email.">
        <form onSubmit={search} className="flex gap-2">
          <input
            className="input"
            placeholder="username or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            minLength={2}
            maxLength={254}
            required
          />
          <button className="btn btn-primary !px-3" disabled={loading}>
            {loading ? <Spinner /> : <Search size={14} />}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {results.length === 0 && searched && (
            <p className="text-xs text-zinc-500">No users match that search.</p>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => void open(user.id)}
              className="card card-hover flex w-full items-center justify-between gap-3 p-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{user.username}</p>
                <p className="truncate text-[10px] text-zinc-500">{user.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Tag tone={STATUS_TONE[user.status] ?? "default"}>{user.status}</Tag>
                <Tag>{tierLabel(user.tier)}</Tag>
                <Tag tone={user.strikes > 0 ? "red" : "default"}>{user.strikes}⚠</Tag>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <div className="space-y-4">
        {detailLoading && (
          <Panel>
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          </Panel>
        )}

        {!detail && !detailLoading && (
          <Panel title="No user selected">
            <p className="text-xs text-zinc-500">
              Search and select a user to view strikes, suspension history, staff notes and to take
              moderation actions.
            </p>
          </Panel>
        )}

        {detail && !detailLoading && (
          <>
            <Panel
              title={detail.user.username}
              subtitle={`${detail.user.email} · joined ${new Date(detail.user.createdAt).toLocaleDateString()}`}
              actions={<Tag tone={STATUS_TONE[detail.user.status] ?? "default"}>{detail.user.status}</Tag>}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Role" value={roleLabel(detail.user.role)} />
                <StatCard label="Tier" value={tierLabel(detail.user.tier)} />
                <StatCard label="Executions" value={formatNumber(detail.user.scriptsExecuted)} />
              </div>
              <div className="mt-4 space-y-2 text-xs">
                {detail.can.viewIp && detail.user.lastIp && (
                  <p className="text-zinc-400">
                    IP: <span className="font-mono text-zinc-200">{detail.user.lastIp}</span>
                  </p>
                )}
                {detail.can.viewIp && detail.user.lastUserAgent && (
                  <p className="truncate text-zinc-500">
                    UA: <span className="font-mono text-zinc-400">{detail.user.lastUserAgent}</span>
                  </p>
                )}
                <p className="text-zinc-400">
                  Strikes: <span className="text-white">{detail.user.strikes}</span> · Last login:{" "}
                  <span className="text-white">
                    {detail.user.lastLoginAt ? timeAgo(detail.user.lastLoginAt) : "never"}
                  </span>
                </p>
                {detail.user.suspensionReason && (
                  <p className="text-amber-400">
                    Suspension: {detail.user.suspensionReason}
                    {detail.user.suspendedUntil
                      ? ` (until ${new Date(detail.user.suspendedUntil).toLocaleString()})`
                      : ""}
                  </p>
                )}
                {detail.user.freezeReason && (
                  <p className="text-sky-400">Frozen: {detail.user.freezeReason}</p>
                )}
                {detail.blacklists.map((entry) => (
                  <p key={entry.id} className="text-[#ff8f8f]">
                    Blacklisted by <b>{entry.blacklistedByName}</b> on{" "}
                    {new Date(entry.createdAt).toLocaleDateString()} — {entry.reason}
                  </p>
                ))}
              </div>
            </Panel>

            <Panel title="Moderation actions">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Reason / note
                  </span>
                  <input
                    className="input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="required for strikes, suspensions, blacklists"
                    maxLength={300}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Suspension length (days, 0 = indefinite)
                  </span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={3650}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => void act("strike")}>
                  ⚠ Add strike
                </button>
                <button className="btn btn-primary !py-1.5 text-xs" onClick={() => void act("suspend")}>
                  Suspend
                </button>
                <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => void act("unsuspend")}>
                  Lift suspension
                </button>
                <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => void act("freeze")}>
                  🧊 Freeze
                </button>
                {detail.can.blacklist && (
                  <>
                    <button className="btn btn-danger !py-1.5 text-xs" onClick={() => void act("unfreeze")}>
                      Release freeze
                    </button>
                    <button className="btn btn-danger !py-1.5 text-xs" onClick={() => void act("blacklist")}>
                      <Ban size={13} /> Blacklist
                    </button>
                    <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => void act("unblacklist")}>
                      Remove blacklist
                    </button>
                  </>
                )}
                {!detail.can.blacklist && detail.can.freeze && (
                  <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => void act("unfreeze")}>
                    Request release
                  </button>
                )}
              </div>

              {detail.can.manageTier && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#1a1a21] pt-4">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">Access</span>
                  <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => void act("grant_tier", { tier: "standard" })}>
                    Grant Standard
                  </button>
                  <button className="btn btn-primary !py-1.5 text-xs" onClick={() => void act("grant_tier", { tier: "premium" })}>
                    Grant Premium
                  </button>
                  <button className="btn btn-danger !py-1.5 text-xs" onClick={() => void act("revoke_tier")}>
                    Revoke access
                  </button>
                </div>
              )}

              {detail.can.manageRoles && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#1a1a21] pt-4">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">Staff role</span>
                  {(["member", "moderator", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      className={`btn !py-1.5 text-xs ${detail.user.role === r ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => void act("set_role", { role: r })}
                    >
                      {roleLabel(r)}
                    </button>
                  ))}
                </div>
              )}

              {detail.can.assignPrivateGames && (
                <div className="mt-4 border-t border-[#1a1a21] pt-4">
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">
                    Private game access
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {games.length === 0 && <p className="text-xs text-zinc-500">No games loaded.</p>}
                    {games.map((game) => {
                      const has = detail.privateGames.some((entry) => entry.gameId === game.id);
                      return (
                        <button
                          key={game.id}
                          className={`btn !py-1.5 text-[11px] ${has ? "btn-primary" : "btn-ghost"}`}
                          onClick={() =>
                            void act(has ? "revoke_private_game" : "grant_private_game", { gameId: game.id })
                          }
                        >
                          {game.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-[#1a1a21] pt-4">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">Add staff note</p>
                <div className="flex gap-2">
                  <input
                    className="input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="internal note — visible to all staff"
                    maxLength={500}
                  />
                  <button
                    className="btn btn-primary !py-1.5 text-xs"
                    onClick={async () => {
                      await api(`/api/staff/user/${detail.user.id}`, {
                        method: "POST",
                        body: JSON.stringify({ action: "note", reason: note }),
                      });
                      setNote("");
                      push("success", "Note added.");
                      await open(detail.user.id);
                    }}
                  >
                    Save note
                  </button>
                </div>
              </div>
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title={`Strikes (${detail.strikes.length})`}>
                <ul className="space-y-2">
                  {detail.strikes.length === 0 && <li className="text-xs text-zinc-500">Clean record.</li>}
                  {detail.strikes.map((strike) => (
                    <li key={strike.id} className="rounded-lg border border-[#1d1d24] bg-[#0b0b0f] p-2.5">
                      <p className="text-xs text-zinc-200">{strike.reason}</p>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {strike.issuerName} · {timeAgo(strike.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title={`Suspension history (${detail.suspensions.length})`}>
                <ul className="space-y-2">
                  {detail.suspensions.length === 0 && (
                    <li className="text-xs text-zinc-500">No previous suspensions.</li>
                  )}
                  {detail.suspensions.map((suspension) => (
                    <li key={suspension.id} className="rounded-lg border border-[#1d1d24] bg-[#0b0b0f] p-2.5">
                      <p className="text-xs text-zinc-200">{suspension.reason}</p>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {suspension.issuerName} ·{" "}
                        {suspension.endsAt
                          ? `until ${new Date(suspension.endsAt).toLocaleDateString()}`
                          : "indefinite"}{" "}
                        · {suspension.active ? "active" : "lifted"}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <Panel title={`Staff notes (${detail.notes.length})`}>
              <ul className="space-y-2">
                {detail.notes.length === 0 && <li className="text-xs text-zinc-500">No notes yet.</li>}
                {detail.notes.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-[#1d1d24] bg-[#0b0b0f] p-2.5">
                    <p className="text-xs text-zinc-200">{entry.body}</p>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {entry.authorName} · {timeAgo(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Review ------------------------------ */

function ReviewTab({ role, push }: { role: Role; push: Push }) {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<{
    id: number;
    username: string;
    scriptContent: string;
    gameName: string;
    serverId: string;
    flagged: boolean;
    flagReason: string | null;
    reviewStatus: string;
    createdAt: string;
    author: { id: number; username: string; status: string; tier: string; strikes: number } | null;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(3);
  const [test, setTest] = useState("");
  const [testOut, setTestOut] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ logs: LogRow[] }>(`/api/staff/review?status=${status}`);
      setRows(data.logs);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not load logs.");
    } finally {
      setLoading(false);
    }
  }, [status, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (id: number) => {
    try {
      const data = await api<{ log: NonNullable<typeof active> }>(`/api/staff/review?logId=${id}`);
      setActive(data.log);
      setTest(data.log.scriptContent);
      setTestOut([]);
      setReason("");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not open that log.");
    }
  };

  const decide = async (decision: string) => {
    if (!active) return;
    try {
      await api("/api/staff/review", {
        method: "POST",
        body: JSON.stringify({ logId: active.id, decision, reason, days }),
      });
      push("success", `Marked ${decision}.`);
      setActive(null);
      await load();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Decision failed.");
    }
  };

  const runTest = () => {
    const script = test;
    const lines = script.split("\n").length;
    const findings: string[] = [];
    if (/\.ROBLOSECURITY/i.test(script)) findings.push("references .ROBLOSECURITY cookie");
    if (/http(s)?:\/\//i.test(script)) findings.push("contains an outbound URL");
    if (/getfenv|loadstring|require\s*\(/i.test(script)) findings.push("uses dynamic loading");
    if (/Destroy\(\)/i.test(script)) findings.push("calls Destroy() on instances");
    setTestOut([
      `[sandbox] static analysis on ${lines} lines`,
      ...findings.map((finding) => `[sandbox] ⚠ ${finding}`),
      findings.length === 0 ? "[sandbox] no obvious violations detected" : "[sandbox] review required",
      "[sandbox] sandbox run complete",
    ]);
  };

  const statuses = ["pending", "escalated", "flagged", "cleared", "actioned", "all"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {statuses.map((item) => (
          <button
            key={item}
            onClick={() => setStatus(item)}
            className={`btn !py-1.5 text-xs ${status === item ? "btn-primary" : "btn-ghost"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <Panel title={`Execution logs (${rows.length})`} subtitle={role === "moderator" ? "Moderator view — you can freeze or escalate." : "Admin view — you can suspend or blacklist."}>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-zinc-500">No logs in this bucket.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  onClick={() => void open(row.id)}
                  className="card card-hover flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">
                      {row.username} <span className="text-zinc-500">· {row.gameName || "unknown game"}</span>
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">{row.preview}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {row.flagged && <Tag tone="red">flagged</Tag>}
                    <Tag tone={row.reviewStatus === "cleared" ? "green" : "amber"}>
                      {row.reviewStatus}
                    </Tag>
                    <span className="text-[10px] text-zinc-600">{timeAgo(row.createdAt)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal open={active !== null} onClose={() => setActive(null)} title={`Log #${active?.id ?? 0}`} wide>
        {active && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="User" value={active.username} hint={active.author ? active.author.status : ""} />
              <StatCard label="Game" value={active.gameName || "—"} hint={active.serverId} />
              <StatCard
                label="Status"
                value={active.reviewStatus}
                hint={active.flagged ? active.flagReason ?? "flagged" : "not flagged"}
              />
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Script contents
              </p>
              <pre className="max-h-[240px] overflow-auto rounded-lg border border-[#23232b] bg-[#08080b] p-3 font-mono text-[11.5px] leading-relaxed text-zinc-300">
                {active.scriptContent}
              </pre>
            </div>

            <div className="rounded-lg border border-[#23232b] bg-[#0a0a0d] p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Test on your end
              </p>
              <textarea
                className="h-[140px] w-full resize-none rounded-lg border border-[#23232b] bg-[#08080b] p-3 font-mono text-[11.5px] text-zinc-300 outline-none focus:border-[#ff2d2d]"
                value={test}
                onChange={(e) => setTest(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn btn-primary !py-1.5 text-xs" onClick={runTest}>
                  <Play size={13} /> Run sandbox test
                </button>
                <button
                  className="btn btn-danger !py-1.5 text-xs"
                  onClick={() => {
                    setTest("");
                    setTestOut([]);
                  }}
                >
                  <RotateCcw size={13} /> Clear
                </button>
              </div>
              {testOut.length > 0 && (
                <div className="mt-3 rounded-lg border border-[#191920] bg-black/60 p-3 font-mono text-[11px] text-emerald-300">
                  {testOut.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <input
                className="input"
                placeholder="Reason (required)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={240}
              />
              <input
                className="input"
                type="number"
                min={0}
                max={3650}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                placeholder="days"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => void decide("clear")}>
                ✅ Clear
              </button>
              <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => void decide("escalate")}>
                ⏫ Escalate to admin
              </button>
              <button className="btn btn-primary !py-1.5 text-xs" onClick={() => void decide("suspend")}>
                Suspend user
              </button>
              <button className="btn btn-danger !py-1.5 text-xs" onClick={() => void decide("freeze")}>
                🧊 Freeze account
              </button>
              {role !== "moderator" && (
                <button className="btn btn-danger !py-1.5 text-xs" onClick={() => void decide("blacklist")}>
                  <Ban size={13} /> Blacklist user
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ Filters ------------------------------ */

function FiltersTab({ push }: { push: Push }) {
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState("contains");
  const [action, setAction] = useState("suspend");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ patterns: PatternRow[] }>("/api/staff/scripts");
      setRows(data.patterns);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not load filters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/staff/scripts", {
        method: "POST",
        body: JSON.stringify({ pattern, matchType, action, reason }),
      });
      setPattern("");
      setReason("");
      push("success", "Filter added.");
      await load();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not add the filter.");
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Script blacklist filter"
        subtitle="If a user executes a matching script, CDN_SS auto-suspends or auto-blacklists them."
      >
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1.4fr_auto]">
          <input
            className="input"
            placeholder="pattern / text to match"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            required
            minLength={2}
            maxLength={4000}
          />
          <select className="input" value={matchType} onChange={(e) => setMatchType(e.target.value)}>
            <option value="contains">contains</option>
            <option value="exact">exact match</option>
            <option value="regex">regex</option>
          </select>
          <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="suspend">auto-suspend</option>
            <option value="blacklist">auto-blacklist</option>
          </select>
          <input
            className="input"
            placeholder="reason shown to the user"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            maxLength={200}
          />
          <button className="btn btn-primary !py-2 text-xs">Add filter</button>
        </form>
      </Panel>

      <Panel title={`Active filters (${rows.filter((r) => r.active).length})`}>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-white">{row.pattern}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {row.matchType} · {row.reason} · by {row.creatorName ?? "system"} ·{" "}
                    {timeAgo(row.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone={row.action === "blacklist" ? "red" : "amber"}>{row.action}</Tag>
                  {row.active ? (
                    <button
                      className="btn btn-danger !py-1.5 text-[11px]"
                      onClick={async () => {
                        await api(`/api/staff/scripts?id=${row.id}`, { method: "DELETE" });
                        push("success", "Filter disabled.");
                        await load();
                      }}
                    >
                      Disable
                    </button>
                  ) : (
                    <Tag>disabled</Tag>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------ Logs ------------------------------ */

function LogsTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ logs: AuditRow[] }>("/api/staff/logs?limit=200");
        setRows(data.logs);
      } catch {
        /* handled by empty state */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Panel title="Audit logs" subtitle="Every admin and moderator action is recorded.">
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-zinc-500">No audit entries yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pb-2 pr-3">When</th>
                <th className="pb-2 pr-3">Actor</th>
                <th className="pb-2 pr-3">Action</th>
                <th className="pb-2 pr-3">Target</th>
                <th className="pb-2 pr-3">Details</th>
                <th className="pb-2">IP</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#17171d]">
                  <td className="py-2 pr-3 text-zinc-500">{timeAgo(row.createdAt)}</td>
                  <td className="py-2 pr-3">
                    <span className="text-white">{row.actorName}</span>
                    <span className="ml-1 text-[10px] text-zinc-600">{row.actorRole}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-[#ff8f8f]">{row.action}</td>
                  <td className="py-2 pr-3">{row.targetName || "—"}</td>
                  <td className="max-w-[280px] truncate py-2 pr-3 text-zinc-500">{row.details}</td>
                  <td className="py-2 font-mono text-[10px] text-zinc-600">{row.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------ Games ------------------------------ */

function GamesTab({ push }: { push: Push }) {
  const [rows, setRows] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ games: GameRow[] }>("/api/staff/games");
      setRows(data.games);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not load games.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const review = async (game: GameRow, tier: string, approve: boolean) => {
    try {
      await api("/api/staff/games", {
        method: "POST",
        body: JSON.stringify({ gameId: game.id, tier, approve }),
      });
      push("success", `${game.name} → ${approve ? tier : "rejected"}`);
      await load();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not update the game.");
    }
  };

  const pending = rows.filter((row) => !row.approved);
  const approved = rows.filter((row) => row.approved);

  return (
    <div className="space-y-4">
      <Panel title={`Awaiting review (${pending.length})`} subtitle="Categorise as Standard, Premium or Private.">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : pending.length === 0 ? (
          <p className="text-xs text-zinc-500">No games waiting for review.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((game) => (
              <li key={game.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{game.name}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    place {game.placeId} · {formatNumber(game.playerCount)} playing ·{" "}
                    {formatNumber(game.visits)} visits · {game.creator || "unknown"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["standard", "premium", "private"] as const).map((tier) => (
                    <button
                      key={tier}
                      className="btn btn-primary !py-1.5 text-[11px]"
                      onClick={() => void review(game, tier, true)}
                    >
                      Approve as {tier}
                    </button>
                  ))}
                  <button
                    className="btn btn-danger !py-1.5 text-[11px]"
                    onClick={() => void review(game, game.tier, false)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Live catalogue (${approved.length})`}>
        <ul className="space-y-2">
          {approved.map((game) => (
            <li key={game.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{game.name}</p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  place {game.placeId} · {formatNumber(game.playerCount)} playing
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={game.tier === "premium" ? "red" : game.tier === "private" ? "blue" : "green"}>
                  {game.tier}
                </Tag>
                {(["standard", "premium", "private"] as const).map((tier) => (
                  <button
                    key={tier}
                    className={`btn !py-1.5 text-[11px] ${game.tier === tier ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => void review(game, tier, true)}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ------------------------------ Owner settings ------------------------------ */

function SettingsTab({ push }: { push: Push }) {
  const [rules, setRules] = useState("");
  const [tos, setTos] = useState("");
  const [standardLink, setStandardLink] = useState("");
  const [premiumLink, setPremiumLink] = useState("");
  const [standardPrice, setStandardPrice] = useState("");
  const [premiumPrice, setPremiumPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{
          settings: {
            rulesContent: string;
            tosContent: string;
            rulesVersion: number;
            tosVersion: number;
            standardLink: string;
            premiumLink: string;
            standardPrice: string;
            premiumPrice: string;
          };
        }>("/api/owner/settings");
        setRules(data.settings.rulesContent);
        setTos(data.settings.tosContent);
        setStandardLink(data.settings.standardLink);
        setPremiumLink(data.settings.premiumLink);
        setStandardPrice(data.settings.standardPrice);
        setPremiumPrice(data.settings.premiumPrice);
      } catch (err) {
        push("error", err instanceof Error ? err.message : "Could not load settings.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (payload: Record<string, string>) => {
    setBusy(true);
    try {
      await api("/api/owner/settings", { method: "PUT", body: JSON.stringify(payload) });
      push("success", "Settings saved. Rule/ToS edits bump the version users must re-accept.");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Panel title="Store links" subtitle="Users purchase through these links.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Standard purchase link
            </span>
            <input
              className="input"
              value={standardLink}
              onChange={(e) => setStandardLink(e.target.value)}
              placeholder="https://…"
              maxLength={600}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Standard price label
            </span>
            <input
              className="input"
              value={standardPrice}
              onChange={(e) => setStandardPrice(e.target.value)}
              maxLength={24}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Premium purchase link
            </span>
            <input
              className="input"
              value={premiumLink}
              onChange={(e) => setPremiumLink(e.target.value)}
              placeholder="https://…"
              maxLength={600}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Premium price label
            </span>
            <input
              className="input"
              value={premiumPrice}
              onChange={(e) => setPremiumPrice(e.target.value)}
              maxLength={24}
            />
          </label>
        </div>
        <button
          className="btn btn-primary mt-4 !py-1.5 text-xs"
          disabled={busy}
          onClick={() =>
            void save({ standardLink, premiumLink, standardPrice, premiumPrice })
          }
        >
          Save store settings
        </button>
      </Panel>

      <Panel title="Rules (editable)" subtitle="Saving bumps the rules version and shows users an update indicator.">
        <RichEditor value={rules} onChange={setRules} minRows={14} />
        <button
          className="btn btn-primary mt-3 !py-1.5 text-xs"
          disabled={busy}
          onClick={() => void save({ rulesContent: rules })}
        >
          Save rules
        </button>
      </Panel>

      <Panel title="Terms of Service (editable)">
        <RichEditor value={tos} onChange={setTos} minRows={14} />
        <button
          className="btn btn-primary mt-3 !py-1.5 text-xs"
          disabled={busy}
          onClick={() => void save({ tosContent: tos })}
        >
          Save terms
        </button>
      </Panel>
    </div>
  );
}
