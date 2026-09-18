/**
 * Server list simulation.
 *
 * Roblox does not expose public server lists to unauthenticated third parties
 * for every experience, so CDN_SS renders a deterministic, live-refreshing
 * server list per place. Real CDN_SS users who attach the executor are merged
 * into the list from `executor_presence`, which also powers the
 * "search for a player" feature.
 */

export type ServerInfo = {
  id: string;
  players: number;
  maxPlayers: number;
  region: string;
  ping: number;
  uptimeMinutes: number;
  players2d: boolean;
  playerNames: string[];
  live: boolean;
};

export type PresenceRow = {
  serverId: string;
  username: string;
};

const NAME_POOL = [
  "xX_Blade_Xx", "NoScopeNathan", "quietstorm", "VexalDev", "bloxboss2009", "kyli_rblx",
  "sigma_henry", "RedstoneRider", "MiraPlays", "draco_onpc", "iiZephyr", "LunarKnight",
  "ByteSizedBen", "phantomjet", "CoffeeCrusader", "notajokester", "SlyFoxNine", "Astra_Glitch",
  "TurboTaco", "midnightmara", "Kxnja", "ZeroPingZane", "VortexVicky", "NeonNinja77",
  "SaltShaker", "QuickScopeQueen", "Gravemind", "PixelProwler", "HexHunter", "OblivionOx",
  "RuneRider", "StaticSam", "CryoCatz", "BlitzBobby", "NovaNate", "EchoElena", "RiftRaider",
  "JinxJules", "CobaltCory", "FrostFang", "HollowHal", "IvoryIris", "JadeJaguar", "KryptKai",
  "LumenLars", "MuteMilo", "NimbusNia", "OnyxOtto", "PrismPia", "QuartzQuinn", "RiftRonin",
  "SolarSage", "TidalTy", "UmbraUgo", "VaporVic", "WispWren", "XenoXiu", "YonderYuki",
  "ZephyrZane", "AtlasAde", "BoltBex", "CinderCy", "DuskDax", "EmberEli", "FluxFae",
  "GaleGus", "HydraHan", "IonIvo", "JoltJax", "KiteKit", "LimeLou", "MistMo", "NectarNed",
  "OrbitOli", "PulsePax", "QuillQai", "RoveRen", "SableSy", "TerraTia", "UmbraUma",
  "VellVic", "WarpWes", "YieldYai", "ZonkZed", "CDN_User_01", "SilentSpectre", "RbxRegular",
  "Anonymous_Ace", "VoidWalker", "ShadowSix", "AimAssistant", "MacroMinded", "LagLord",
  "DiamondDust", "ScriptKid99", "ServerSideSam", "placeIDPete",
];

const REGIONS = ["US-East", "US-West", "EU-Central", "EU-West", "Asia-Singapore", "SA-Brazil"];

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateServers(
  placeId: string,
  presence: PresenceRow[] = [],
  tick: number = Math.floor(Date.now() / 15000),
): ServerInfo[] {
  const baseSeed = hashString(`cdn_ss:${placeId}`);
  const serverCount = 8 + (baseSeed % 14);
  const servers: ServerInfo[] = [];

  for (let i = 0; i < serverCount; i += 1) {
    const rand = mulberry32(hashString(`${placeId}:${i}:${tick}`));
    const maxPlayers = [12, 20, 24, 30, 40, 50][Math.floor(rand() * 6)];
    const fill = 0.15 + rand() * 0.85;
    const players = Math.max(1, Math.min(maxPlayers, Math.round(maxPlayers * fill)));
    const names = new Set<string>();
    for (let p = 0; p < players; p += 1) {
      names.add(NAME_POOL[Math.floor(rand() * NAME_POOL.length)]);
    }
    servers.push({
      id: `srv-${(baseSeed + i * 7919).toString(36).padStart(6, "0")}`,
      players,
      maxPlayers,
      region: REGIONS[Math.floor(rand() * REGIONS.length)],
      ping: Math.round(18 + rand() * 130),
      uptimeMinutes: Math.round(rand() * 640),
      players2d: rand() > 0.35,
      playerNames: Array.from(names),
      live: false,
    });
  }

  const presenceByServer = new Map<string, Set<string>>();
  for (const row of presence) {
    const existing = presenceByServer.get(row.serverId) ?? new Set<string>();
    existing.add(row.username);
    presenceByServer.set(row.serverId, existing);
  }

  for (const [serverId, names] of presenceByServer) {
    const target =
      servers.find((s) => s.id === serverId) ??
      servers[(hashString(serverId) % servers.length + servers.length) % servers.length];
    if (!target) continue;
    for (const name of names) target.playerNames.push(name);
    target.players = Math.min(target.maxPlayers, target.playerNames.length + 1);
    target.live = true;
  }

  return servers.sort((a, b) => b.players - a.players);
}

export function searchServers(servers: ServerInfo[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return servers
    .map((server) => ({
      server,
      matches: server.playerNames.filter((name) => name.toLowerCase().includes(needle)),
    }))
    .filter((entry) => entry.matches.length > 0);
}
