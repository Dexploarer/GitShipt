import { dbHttp } from "@/db";
import { projectMemberships, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Lightweight read-only helpers for sidebar/UI gating decisions.
 *
 * These deliberately do **not** use the full `requirePermission()` matrix —
 * they answer the narrow question "should the UI show admin-y affordances?"
 * Server actions and API routes still re-check via `requirePermission()` /
 * `destructiveAction()` so the UI signal can never be trusted as authority.
 *
 * Both functions accept `null` so callers can pass an unauthenticated user
 * without an extra branch.
 */

/**
 * True when the user can administer the given project — either because they
 * hold a project-scoped role (`project_owner` / `project_moderator`) or
 * because they have a platform role (`admin` / `super_admin`).
 *
 * Returns `false` for null users, missing memberships, or DB errors.
 */
export async function isProjectAdmin(
  userId: string | null,
  projectId: string,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const [user] = await dbHttp
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user && (user.role === "admin" || user.role === "super_admin")) {
      return true;
    }
    const [membership] = await dbHttp
      .select({ role: projectMemberships.role })
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.userId, userId),
          eq(projectMemberships.projectId, projectId),
        ),
      )
      .limit(1);
    if (!membership) return false;
    return (
      membership.role === "project_owner" ||
      membership.role === "project_moderator"
    );
  } catch {
    return false;
  }
}

/**
 * True when the user has a platform-wide admin role (`admin` /
 * `super_admin`). Used to decide whether to render the Admin entry in
 * the dashboard / public sidebars.
 */
export async function isPlatformAdmin(
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const [user] = await dbHttp
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return false;
    return user.role === "admin" || user.role === "super_admin";
  } catch {
    return false;
  }
}
