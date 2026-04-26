import "server-only";
import { headers } from "next/headers";
import { auth } from "./index";
import { isPlatformAdmin } from "./admin-check";
import { hasCredentials } from "@/lib/env";

/**
 * Session-derived user shape consumed by `<PublicAppShell>` and the
 * `<AuthSidebar>` / `<UnauthSidebar>` switch inside it.
 *
 * Returns `null` when:
 *   - DB credentials are absent (stub mode)
 *   - No session cookie is present
 *   - Better-auth's getSession throws (network blip / cold start)
 *
 * Public pages (landing, /explore, /leaderboard, /docs, /u/[username],
 * /legal/*) MUST call this and pass the result to `<PublicAppShell user>`
 * — otherwise the shell falls through to the unauth sidebar even for
 * signed-in users, and the UI looks like the user got signed out on
 * navigation.
 *
 * Implementation note: this helper is the single source of truth for
 * "who is the current user, formatted for chrome". Anything that needs
 * permission checks should still use `requirePermission()` / `hasPermission()`
 * directly with the user id from the underlying session lookup.
 */
export interface SessionUserChrome {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  imageUrl: string | null;
  isPlatformAdmin: boolean;
}

export async function getSessionUser(): Promise<SessionUserChrome | null> {
  if (!hasCredentials.db()) return null;

  let session: Awaited<ReturnType<ReturnType<typeof auth>["api"]["getSession"]>>;
  try {
    session = await auth().api.getSession({ headers: await headers() });
  } catch {
    return null;
  }

  if (!session?.user?.id) return null;

  const isAdmin = await isPlatformAdmin(session.user.id);

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    username:
      (session.user as { githubUsername?: string | null }).githubUsername ??
      null,
    imageUrl: session.user.image ?? null,
    isPlatformAdmin: isAdmin,
  };
}
