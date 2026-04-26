import "server-only";
import { notFound } from "next/navigation";
import { requireAuthSession } from "@/lib/auth/session";
import {
  requirePermission,
  PermissionError,
  type Permission,
} from "@/lib/auth/permissions";
import { getProjectRecord, type ProjectRecord } from "@/lib/queries/dashboard";

export interface LoadedProjectContext {
  userId: string;
  userName: string;
  userEmail: string;
  project: ProjectRecord;
}

/**
 * Server-side helper used by every `/dashboard/projects/[id]/**` page.
 *
 *  1. Re-validates the better-auth session (CVE-2025-29927 mitigation).
 *  2. Loads the project (404 on miss).
 *  3. Checks the requested permission for this project (404 on deny — we
 *     don't reveal that the project exists to unprivileged users).
 */
export async function loadProjectFor(
  projectId: string,
  permission: Permission,
): Promise<LoadedProjectContext> {
  const session = await requireAuthSession(`/dashboard/projects/${projectId}`);
  const project = await getProjectRecord(projectId);
  if (!project) notFound();

  try {
    await requirePermission(permission, {
      userId: session.user.id,
      projectId,
    });
  } catch (e) {
    if (e instanceof PermissionError) notFound();
    throw e;
  }

  return {
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "user",
    userEmail: session.user.email ?? "",
    project,
  };
}
