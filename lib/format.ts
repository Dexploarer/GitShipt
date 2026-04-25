/**
 * Tiny pure formatters for SOL, USD, scores, percentages, addresses, and
 * relative timestamps. Used everywhere we render economic values in mono.
 *
 * No dependencies, no Intl edge-case games beyond what we explicitly use.
 * Every function is deterministic and safe to call inside Server Components.
 */

const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Format a lamports BigInt as a SOL string with fixed decimals.
 * Example: formatSol(12_452_300_000n) → "12.4523 SOL"
 */
export function formatSol(lamports: bigint, decimals = 4): string {
  const negative = lamports < 0n;
  const abs = negative ? -lamports : lamports;
  const whole = abs / LAMPORTS_PER_SOL;
  const remainder = abs % LAMPORTS_PER_SOL;
  // Pad remainder to 9 digits then trim to `decimals`.
  const fractional = remainder.toString().padStart(9, "0").slice(0, decimals);
  const sign = negative ? "-" : "";
  const wholeStr = whole.toString();
  return decimals > 0
    ? `${sign}${wholeStr}.${fractional} SOL`
    : `${sign}${wholeStr} SOL`;
}

/**
 * Format USD as `$1,532.21` or `—` if null/undefined.
 */
export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Thousands-separated integer score, e.g. 12456 → "12,456".
 */
export function formatScore(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/**
 * Format a 0..100 number as `25.0%`.
 */
export function formatPercent(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(decimals)}%`;
}

/**
 * Compact relative timestamp ("just now", "2m ago", "3h ago", "5d ago").
 * Falls back to a localized date for ages over 30 days.
 */
export function formatRelativeTime(date: Date): string {
  const ms = Date.now() - date.getTime();
  if (ms < 0) {
    // Future — used for countdowns elsewhere; this helper just returns "soon".
    return "soon";
  }
  const sec = Math.floor(ms / 1000);
  if (sec < 30) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Abbreviate a long address: `8xG7...a1b2`. Safe with short inputs (returns
 * the original string unchanged when it's already shorter than the elision).
 */
export function formatAddress(addr: string, prefix = 4, suffix = 4): string {
  if (!addr) return "";
  if (addr.length <= prefix + suffix + 1) return addr;
  return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}`;
}
