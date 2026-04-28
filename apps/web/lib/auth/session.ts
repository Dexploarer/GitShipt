import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./index";
import { isPlatformAdmin } from "./admin-check";
import { hasCredentials } from "@/lib/env";
import {
  getAccountProfile,
  getAccountSettings,
} from "@/lib/queries/account";

type BetterAuthSession = Awaited<
  ReturnType<ReturnType<typeof auth>["api"]["getSession"]>
>;

export type AuthSessionWithUser = NonNullable<BetterAuthSession> & {
  user: NonNullable<NonNullable<BetterAuthSession>["user"]> & { id: string };
};

/**
 * Session-derived user shape consumed by `<PublicAppShell>` and the
 * `<AuthSidebar>` / `<UnauthSidebar>` switch inside it.
 *
 * Returns `null` when:
 *   - DB credentials are absent (stub mode)
 *   - No session cookie is present
 *   - Better-auth's getSession throws (network blip / cold start)
 *
 * Root layout resolves this once per request and seeds the client chrome
 * context. Shells can still call it directly when they need server-side
 * decisions, but sidebars should not re-fetch it per page.
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
  defaultDashboardRoute?: string;
  isPlatformAdmin: boolean;
}

async function readAuthSession({
  catchErrors,
}: {
  catchErrors: boolean;
}): Promise<AuthSessionWithUser | null> {
  if (!hasCredentials.db()) return null;

  let session: BetterAuthSession;
  try {
    session = await auth().api.getSession({ headers: await headers() });
  } catch (error) {
    if (catchErrors) return null;
    throw error;
  }

  if (!session?.user?.id) return null;
  return session as AuthSessionWithUser;
}

export const getAuthSession = cache(async () =>
  readAuthSession({ catchErrors: true }),
);

export const requireAuthSession = cache(
  async (next = "/dashboard"): Promise<AuthSessionWithUser> => {
    const session = await readAuthSession({ catchErrors: false });
    if (!session?.user?.id) {
      redirect(`/auth/signin?next=${encodeURIComponent(next)}`);
    }
    return session;
  },
);

export function toSessionUserChrome(
  session: AuthSessionWithUser,
  isAdmin: boolean,
  profile?: {
    githubUsername: string | null;
    image: string | null;
  } | null,
  settings?: {
    defaultDashboardRoute: string;
  } | null,
): SessionUserChrome {
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    username:
      profile?.githubUsername ??
      (session.user as { githubUsername?: string | null }).githubUsername ??
      null,
    imageUrl: profile?.image ?? session.user.image ?? null,
    defaultDashboardRoute: settings?.defaultDashboardRoute ?? "/dashboard",
    isPlatformAdmin: isAdmin,
  };
}

export const getSessionUser = cache(
  async (): Promise<SessionUserChrome | null> => {
    const session = await getAuthSession();
    if (!session?.user?.id) return null;

    const [isAdmin, profile, settings] = await Promise.all([
      isPlatformAdmin(session.user.id),
      getAccountProfile(session.user.id),
      getAccountSettings(session.user.id),
    ]);

    return toSessionUserChrome(session, isAdmin, profile, settings);
  },
);
