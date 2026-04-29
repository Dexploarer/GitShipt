/**
 * Auth cookie constants for Supabase Auth.
 *
 * Supabase stores session data in cookies with project-specific names.
 * The cookie name pattern is: `sb-<project-ref>-auth-token`
 *
 * We check for cookies starting with `sb-` since the exact project ref
 * varies between environments. Per CVE-2025-29927 proxy-only auth is
 * never the security boundary; the cookie sniff is a UX shortcut, not
 * authorization.
 */

/**
 * Supabase auth cookie prefix. All Supabase auth cookies start with "sb-".
 */
export const SUPABASE_COOKIE_PREFIX = "sb-" as const;

/**
 * True when the request carries a Supabase session cookie. Pure function
 * over a cookie-jar accessor so it works from `proxy.ts`, `next/headers`
 * cookies(), or a Request object.
 */
export function hasAuthCookie(
  reader:
    | { get: (name: string) => unknown }
    | { getAll: () => Array<{ name: string; value: string }> }
    | undefined,
): boolean {
  if (!reader) return false;

  // Check if reader has getAll method (NextRequest.cookies style)
  if ("getAll" in reader && typeof reader.getAll === "function") {
    const cookies = reader.getAll();
    return cookies.some(
      (cookie) =>
        cookie.name.startsWith(SUPABASE_COOKIE_PREFIX) &&
        cookie.name.includes("-auth-token"),
    );
  }

  // Fallback: can't enumerate cookies with just .get(), so we can't check
  // Supabase cookies reliably without the project ref.
  // Return false to be safe - actual auth is validated server-side anyway.
  return false;
}

/**
 * Checks for Supabase auth cookies in a cookie iterator/array.
 */
export function hasSupabaseAuthCookies(
  cookies: Iterable<{ name: string }>,
): boolean {
  for (const cookie of cookies) {
    if (
      cookie.name.startsWith(SUPABASE_COOKIE_PREFIX) &&
      cookie.name.includes("-auth-token")
    ) {
      return true;
    }
  }
  return false;
}
