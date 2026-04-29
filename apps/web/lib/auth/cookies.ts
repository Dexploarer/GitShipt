/**
 * Auth cookie constants.
 *
 * better-auth's default Drizzle adapter writes a session cookie under one
 * of these two names depending on whether the response is sent over HTTPS:
 *
 *   - `better-auth.session_token`            (HTTP / dev / preview)
 *   - `__Secure-better-auth.session_token`   (HTTPS / production — `__Secure-`
 *     prefix mandates Secure flag, blocking accidental cleartext leakage)
 *
 * We read both shapes whenever we sniff for "is the user signed in" before
 * the route handler revalidates the session in-process. Per CVE-2025-29927
 * proxy-only auth is never the security boundary; the cookie sniff is a
 * UX shortcut, not authorization.
 *
 * Centralizing the names here means a future better-auth config change is a
 * one-file diff instead of a grep of the codebase.
 */

export const AUTH_COOKIE_NAME = "better-auth.session_token" as const;
export const AUTH_COOKIE_NAME_SECURE =
  "__Secure-better-auth.session_token" as const;

export const AUTH_COOKIE_NAMES = [
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME_SECURE,
] as const;

/**
 * True when the request carries either better-auth session cookie. Pure
 * function over a cookie-jar accessor so it works from `proxy.ts`,
 * `next/headers` cookies(), or a Request object.
 */
export function hasAuthCookie(
  reader: { get: (name: string) => unknown } | undefined,
): boolean {
  if (!reader) return false;
  for (const name of AUTH_COOKIE_NAMES) {
    if (reader.get(name)) return true;
  }
  return false;
}
