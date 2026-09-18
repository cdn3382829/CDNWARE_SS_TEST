export type Role = "member" | "moderator" | "admin" | "owner";
export type Tier = "none" | "standard" | "premium";
export type AccountStatus = "active" | "suspended" | "frozen" | "blacklisted";
export type GameTier = "standard" | "premium" | "private";

export type SessionUser = {
  id: number;
  username: string;
  email: string;
  role: Role;
  tier: Tier;
  status: AccountStatus;
  bio: string;
  avatarUrl: string;
  scriptsExecuted: number;
  strikes: number;
  acceptedTos: boolean;
  acceptedTosVersion: number;
  acceptedRulesVersion: number;
  onboardingComplete: boolean;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  createdAt: string;
};

export const isStaff = (role: Role) => role === "moderator" || role === "admin" || role === "owner";
export const isAdmin = (role: Role) => role === "admin" || role === "owner";
export const isOwner = (role: Role) => role === "owner";

export const permissions = {
  viewIp: (role: Role) => isAdmin(role),
  blacklist: (role: Role) => isAdmin(role),
  manageTier: (role: Role) => isAdmin(role),
  assignPrivateGames: (role: Role) => isOwner(role),
  manageRoles: (role: Role) => isOwner(role),
  reviewGames: (role: Role) => isOwner(role),
  reviewFlags: (role: Role) => isAdmin(role),
  manageScriptBlacklist: (role: Role) => isAdmin(role),
  postAnnouncements: (role: Role) => isAdmin(role),
  editRules: (role: Role) => isOwner(role),
  viewAuditLogs: (role: Role) => isAdmin(role),
  suspend: (role: Role) => isStaff(role),
  addNotes: (role: Role) => isStaff(role),
  issueStrikes: (role: Role) => isStaff(role),
  seeScriptLogs: (role: Role) => isStaff(role),
  moderateForum: (role: Role) => isStaff(role),
  editStoreLinks: (role: Role) => isOwner(role),
};

export function tierLabel(tier: Tier): string {
  if (tier === "premium") return "Premium";
  if (tier === "standard") return "Customer";
  return "Member";
}

export function roleLabel(role: Role): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return "Member";
}

export function statusLabel(status: AccountStatus): string {
  if (status === "blacklisted") return "Blacklisted";
  if (status === "frozen") return "Frozen";
  if (status === "suspended") return "Suspended";
  return "Active";
}

/** A suspended user whose window has elapsed is treated as active again. */
export function effectiveStatus(user: {
  status: AccountStatus;
  suspendedUntil: Date | string | null;
}): AccountStatus {
  if (user.status !== "suspended") return user.status;
  const until = user.suspendedUntil ? new Date(user.suspendedUntil).getTime() : 0;
  if (until && until <= Date.now()) return "active";
  return "suspended";
}

export const BADGES: Record<string, { name: string; icon: string; description: string }> = {
  founder: { name: "Founder", icon: "👑", description: "Created CDN_SS." },
  early: { name: "Early Adopter", icon: "🚀", description: "Joined during launch week." },
  staff: { name: "Staff Team", icon: "🛡️", description: "Part of the CDN_SS staff team." },
  customer: { name: "Customer", icon: "🎫", description: "Active Standard access." },
  premium: { name: "Premium", icon: "💎", description: "Active Premium access." },
  first_exec: { name: "First Execution", icon: "⚡", description: "Ran a first server script." },
  veteran: { name: "Veteran", icon: "🏆", description: "100+ scripts executed." },
  bug_hunter: { name: "Bug Hunter", icon: "🐛", description: "Reported a confirmed bug." },
  helpful: { name: "Helpful", icon: "🤝", description: " Helpful community member." },
};

export const FORUM_SECTIONS = [
  { key: "scripts", label: "Scripts", icon: "📜", blurb: "Share and discuss server-side scripts." },
  { key: "support", label: "Support", icon: "🛠️", blurb: "Need help? Ask the team here." },
  {
    key: "suggestions",
    label: "Suggestions",
    icon: "💡",
    blurb: "Ideas and feature requests for CDN_SS.",
  },
  { key: "talk", label: "Just Talk", icon: "💬", blurb: "Off-topic discussion lounge." },
] as const;

export type ForumSectionKey = (typeof FORUM_SECTIONS)[number]["key"];
export const FORUM_SECTION_KEYS = FORUM_SECTIONS.map((s) => s.key) as ForumSectionKey[];
