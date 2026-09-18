/** Shared formatting helpers usable from both server and client components. */

export function timeAgo(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(Math.abs(diff) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export const BADGE_META: Record<string, { name: string; icon: string }> = {
  founder: { name: "Founder", icon: "👑" },
  early: { name: "Early Adopter", icon: "🚀" },
  staff: { name: "Staff Team", icon: "🛡️" },
  customer: { name: "Customer", icon: "🎫" },
  premium: { name: "Premium", icon: "💎" },
  first_exec: { name: "First Execution", icon: "⚡" },
  veteran: { name: "Veteran", icon: "🏆" },
  bug_hunter: { name: "Bug Hunter", icon: "🐛" },
  helpful: { name: "Helpful", icon: "🤝" },
};
