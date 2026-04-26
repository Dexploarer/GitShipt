import "server-only";
import { isProjectAdmin } from "./admin-check";
import { getSessionUser } from "./session";

/**
 * Resolves project-scoped chrome that every page under `/r/[org]/[repo]/*`
 * needs to feed `<ProjectShell>`.
 *
 * Returns `canAdmin: false` when there's no session. The root layout already
 * seeds the global user card through SessionChromeProvider; this helper only
 * answers the project-specific admin question.
 *
 * Centralized so every sub-route (leaderboard / payouts / snapshots /
 * repository / token / docs) shares one implementation; previously only
 * the root `/r/[org]/[repo]/page.tsx` looked the session up, which made
 * the user card silently disappear when navigating into a sub-route.
 */
export interface ProjectShellChrome {
  canAdmin: boolean;
}

export async function getProjectShellChrome(
  projectId: string,
): Promise<ProjectShellChrome> {
  const user = await getSessionUser();
  if (!user) return { canAdmin: false };

  let canAdmin = false;
  try {
    canAdmin = await isProjectAdmin(user.id, projectId);
  } catch {
    canAdmin = false;
  }

  return { canAdmin };
}
