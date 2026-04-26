import "server-only";
import { notFound } from "next/navigation";
import { requireAuthSession } from "./session";
import {
  PermissionError,
  requirePermission,
  type Permission,
} from "./permissions";

export async function requirePagePermission(
  permission: Permission,
  next: string,
) {
  const session = await requireAuthSession(next);

  try {
    await requirePermission(permission, { userId: session.user.id });
  } catch (error) {
    if (error instanceof PermissionError) notFound();
    throw error;
  }

  return session;
}

export async function requireAdminPage(
  permission: Permission = "admin.access",
  next = "/admin",
) {
  return requirePagePermission(permission, next);
}
