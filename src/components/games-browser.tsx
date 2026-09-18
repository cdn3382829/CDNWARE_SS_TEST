"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Users, Wifi, Server as ServerIcon, Lock, RefreshCw } from "lucide-react";
import { api, EmptyState, Notice, Spinner, Tag, useInterval, useToast } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { Executor } from "@/components/executor";

type GameItem = {
  id: number;
  name: string;
  placeId: string;
  creator: string;
  playerCount: number;
  visits: number;
  tier: "standard" | "premium" | "private";
  locked: boolean;
};

type ServerInfo = {
  id: string;
  players: number;
  maxPlayers: number;
  region: string;
  ping: number;
  uptimeMinutes: number;
  playerNames: string[];
  live: boolean;
};

type Match = { server: ServerInfo; matches: string[] };

export function GamesBrowser() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<GameItem | null>(null);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [serversLoading, setServersLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<ServerInfo | null>(null);
  const [lastSync, setLastSync] = useState<number>(0);
  const { toast, push, clear } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ games: GameItem[] }>("/api/games");
        setGames(data.games);
      } catch (err) {
        push("error", err instanceof Error ? err.message : "Could not load games.");
      } finally {
        setLoading(false);
      }
    })();
  }, [push]);

  const loadServers = useCallback(
    async (gameId: number, player?: string) => {
      setServersLoading(true);
      try {
        const url = new URL(`/api/games/${gameId}/servers`, window.location.origin);
        if (player) url.searchParams.set("player", player);
        const data = await api<{ servers: ServerInfo[]; matches: Match[]; tick: number }>(url.pathname + url.search);
        setServers(data.servers);
        setMatches(data.matches);
        setLastSync(data.tick);
      } catch (err) {
        push("error", err instanceof Error ? err.message : "Could not load servers.");
      } finally {
        setServersLoading(false);
      }
    },
    [push],
  );

  const openGame = async (game: GameItem) => {
    if (game.locked) {
      push("info", "Upgrade your tier in the Store to unlock this game.");
      return;
    }
    setActive(game);
    setSelectedServer(null);
    setPlayerSearch("");
    await loadServers(game.id);
  };

  useInterval(
    () => {
      if (active) void loadServers(active.id, playerSearch);
    },
    active && !selectedServer ? 15_000 : null,
  );

  const attach = async (server: ServerInfo) => {
    if (!active) return;
    try {
      await api(`/api/games/${active.id}/servers`, {
        method: "POST",
        body: JSON.stringify({ serverId: server.id }),
      });
      setSelectedServer(server);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Could not attach to that server.");
    }
  };

  const search = async () => {
    if (!active || playerSearch.trim().length < 2) {
      setMatches([]);
      return;
    }
    await loadServers(active.id, playerSearch.trim());
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return games;
    return games.filter(
      (game) =>
        game.name.toLowerCase().includes(needle) ||
        game.placeId.includes(needle) ||
        game.creator.toLowerCase().includes(needle),
    );
  }, [games, query]);

  return (
    <div className="space-y-5">
      {toast && <Notice kind={toast.kind} onClose={clear}>{toast.text}</Notice>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <>
          <div className="card anim-fade-up p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  className="input pl-9"
                  placeholder="Search games by name, place ID or creator"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                {games.length} games available to your account
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!active ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {filtered.length === 0 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <EmptyState icon="🎮" title="No games match that search" />
                  </div>
                )}
                {filtered.map((game, index) => (
                  <motion.button
                    key={game.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.35 }}
                    onClick={() => void openGame(game)}
                    className={`card card-hover group relative overflow-hidden p-4 text-left ${
                      game.locked ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{game.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                          {game.creator || "unknown creator"}
                        </p>
                      </div>
                      {game.locked ? (
                        <Lock size={15} className="shrink-0 text-[#ff6b6b]" />
                      ) : (
                        <span className="text-lg">🎮</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Tag>
                        <Users size={11} /> {formatNumber(game.playerCount)}
                      </Tag>
                      <Tag>place {game.placeId.slice(0, 10)}</Tag>
                    </div>
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-zinc-600">
                      {formatNumber(game.visits)} visits
                    </p>
                    <span className="absolute inset-x-0 bottom-0 h-[2px] scale-x-0 bg-gradient-to-r from-transparent via-[#ff2d2d] to-transparent transition-transform duration-500 group-hover:scale-x-100" />
                  </motion.button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="servers"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="card anim-fade-up flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setActive(null)}>
                        ← Back
                      </button>
                      <h2 className="text-sm font-bold text-white">{active.name}</h2>
                    </div>
                    <p className="mt-1.5 pl-1 text-[11px] text-zinc-500">
                      place {active.placeId} · {formatNumber(active.playerCount)} playing ·{" "}
                      {formatNumber(active.visits)} visits
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedServer && (
                      <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setSelectedServer(null)}>
                        <ServerIcon size={13} /> Server list
                      </button>
                    )}
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                      live · synced {lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}
                    </span>
                    <button
                      className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
                      onClick={() => void loadServers(active.id, playerSearch)}
                    >
                      <RefreshCw size={13} className={serversLoading ? "anim-spin" : ""} /> Refresh
                    </button>
                  </div>
                </div>

                {!selectedServer ? (
                  <>
                    <div className="card anim-fade-up delay-1 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[220px]">
                          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                          <input
                            className="input pl-9"
                            placeholder="Find the exact server a player is in (username)"
                            value={playerSearch}
                            onChange={(e) => setPlayerSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void search();
                            }}
                          />
                        </div>
                        <button className="btn btn-primary !py-2 text-xs" onClick={() => void search()}>
                          Search player
                        </button>
                      </div>

                      <AnimatePresence>
                        {matches.length > 0 && (
                          <motion.ul
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 space-y-2 overflow-hidden"
                          >
                            {matches.map((match) => (
                              <li
                                key={match.server.id}
                                className="anim-pop flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#4a1414] bg-[#160707] px-3 py-2"
                              >
                                <span className="text-xs text-zinc-300">
                                  <span className="font-semibold text-white">{match.server.id}</span>{" "}
                                  · {match.server.players}/{match.server.maxPlayers} players ·{" "}
                                  {match.server.region}
                                </span>
                                <span className="flex items-center gap-2">
                                  <Tag tone="red">{match.matches.slice(0, 3).join(", ")}</Tag>
                                  <button
                                    className="btn btn-primary !px-3 !py-1 text-[11px]"
                                    onClick={() => void attach(match.server)}
                                  >
                                    Attach
                                  </button>
                                </span>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {serversLoading && servers.length === 0 ? (
                        <div className="flex justify-center py-10 md:col-span-2 xl:col-span-3">
                          <Spinner className="h-6 w-6" />
                        </div>
                      ) : (
                        servers.map((server, index) => (
                          <motion.button
                            key={server.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.02, 0.3) }}
                            onClick={() => void attach(server)}
                            className="card card-hover p-4 text-left"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-mono text-xs font-semibold text-white">{server.id}</p>
                              {server.live && (
                                <span className="tag border-[#5a1414] bg-[#1b0808] text-[#ff6b6b]">
                                  <span className="anim-blink h-1.5 w-1.5 rounded-full bg-[#ff2d2d]" /> live
                                </span>
                              )}
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#141419]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#8f0f0f] to-[#ff2d2d] transition-all duration-700"
                                style={{ width: `${(server.players / server.maxPlayers) * 100}%` }}
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Tag>
                                <Users size={11} /> {server.players}/{server.maxPlayers}
                              </Tag>
                              <Tag>
                                <Wifi size={11} /> {server.ping}ms
                              </Tag>
                              <Tag>{server.region}</Tag>
                            </div>
                            <p className="mt-3 truncate text-[10px] text-zinc-600">
                              {server.playerNames.slice(0, 6).join(", ")}
                              {server.playerNames.length > 6 ? ` +${server.playerNames.length - 6}` : ""}
                            </p>
                          </motion.button>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <Executor game={active} server={selectedServer} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
