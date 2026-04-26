/**
 * Navigation "origin" tracking — powers the `← Return to <origin>` link in
 * `<ContextSidebar>` for deep-drill views (project pages, admin pages, etc.).
 *
 * Origins are passed via the URL search param `?from=<key>` so they're
 * deep-linkable, back/forward-able, and SSR-safe (no referrer dependency).
 *
 * Whitelisted to avoid open-redirect / spoofing — anything not in this map
 * silently falls back to the default ("Explore").
 */

export type OriginKey =
  | "home"
  | "explore"
  | "leaderboard"
  | "dashboard"
  | "dashboard.projects"
  | "dashboard.earnings"
  | "u";

export interface OriginInfo {
  /** The label shown after "Return to". */
  label: string;
  /** The href to navigate back to. May be parameterized — see `resolveOrigin`. */
  href: string;
}

const FIXED_ORIGINS: Record<Exclude<OriginKey, "u">, OriginInfo> = {
  home: { label: "Home", href: "/" },
  explore: { label: "Explore", href: "/explore" },
  leaderboard: { label: "Leaderboard", href: "/leaderboard" },
  dashboard: { label: "Dashboard", href: "/dashboard" },
  "dashboard.projects": {
    label: "My projects",
    href: "/dashboard",
  },
  "dashboard.earnings": {
    label: "Earnings",
    href: "/dashboard/earnings",
  },
};

const DEFAULT_ORIGIN: OriginInfo = FIXED_ORIGINS.explore;

/**
 * Resolve an arbitrary `?from=` value to a safe (label, href) pair.
 *
 * Accepts:
 *  - one of the fixed `OriginKey`s above
 *  - the parameterized form `u/<username>` for "Return to @username"
 *
 * Anything else falls back to the default origin (Explore). Never returns
 * an external URL or anything that wasn't built from a known template.
 */
export function resolveOrigin(from: string | null | undefined): OriginInfo {
  if (!from) return DEFAULT_ORIGIN;
  const trimmed = from.trim();

  // Parameterized: "u/<username>"
  if (trimmed.startsWith("u/")) {
    const username = trimmed.slice(2);
    if (/^[A-Za-z0-9-]{1,39}$/.test(username)) {
      return {
        label: `@${username}`,
        href: `/u/${username}`,
      };
    }
    return DEFAULT_ORIGIN;
  }

  if (trimmed in FIXED_ORIGINS) {
    return FIXED_ORIGINS[trimmed as keyof typeof FIXED_ORIGINS];
  }
  return DEFAULT_ORIGIN;
}

/**
 * Append `?from=<origin>` to an internal href. Use on outbound `<Link>`s
 * that lead into a deep-drill view so the destination's `<ContextSidebar>`
 * can render an accurate "← Return to" link.
 *
 * Pass-through: if `origin` is undefined, returns `href` unchanged.
 */
export function withOrigin(
  href: string,
  origin: OriginKey | null | undefined,
): string {
  if (!origin) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${encodeURIComponent(origin)}`;
}
