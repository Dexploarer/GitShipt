import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasCredentials } from "@/lib/env";
import {
  hasPermission,
  type Permission,
} from "@/lib/auth/permissions";

/**
 * Server wrapper that re-validates the session and checks `permission`
 * inside the route. This is the in-route security boundary required by
 * CVE-2025-29927 — proxy.ts only 404s admin paths cosmetically; actual
 * authorization happens here.
 *
 * - No session → redirect to /auth/signin?next=...
 * - Session but missing permission → 404 (do not reveal route existence).
 *
 * Returns the resolved actor user id for downstream actions.
 */
export interface PermissionGateResult {
  userId: string;
}

export async function PermissionGate({
  permission,
  projectId,
  next,
}: {
  permission: Permission;
  projectId?: string;
  next: string;
}): Promise<PermissionGateResult> {
  if (!hasCredentials.db()) {
    // Stub mode — DB not configured. Pretend a 404 so the route renders
    // an unowned shell. The page should still render its stub state.
    notFound();
  }

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/auth/signin?next=${encodeURIComponent(next)}`);
  }
  const userId = session.user.id;

  const ok = await hasPermission(permission, { userId, projectId });
  if (!ok) {
    notFound();
  }

  return { userId };
}
