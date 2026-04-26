import "server-only";
import { isProjectAdmin } from "./admin-check";
import { getSessionUser, type SessionUserChrome } from "./session";

/**
 * Resolves the chrome (`user` + `canAdmin`) that every page under
 * `/r/[org]/[repo]/*` needs to feed `<ProjectShell>`.
 *
 * Returns `{ user: null, canAdmin: false }` when there's no session — the
 * ProjectShell then renders without the user card and without the admin
 * nav group.
 *
 * Centralized so every sub-route (leaderboard / payouts / snapshots /
 * repository / token / docs) shares one implementation; previously only
 * the root `/r/[org]/[repo]/page.tsx` looked the session up, which made
 * the user card silently disappear when navigating into a sub-route.
 */
export interface ProjectShellChrome {
  user: SessionUserChrome | null;
  canAdmin: boolean;
}

export async function getProjectShellChrome(
  projectId: string,
): Promise<ProjectShellChrome> {
  const user = await getSessionUser();
  if (!user) return { user: null, canAdmin: false };

  let canAdmin = false;
  try {
    canAdmin = await isProjectAdmin(user.id, projectId);
  } catch {
    canAdmin = false;
  }

  return { user, canAdmin };
}
