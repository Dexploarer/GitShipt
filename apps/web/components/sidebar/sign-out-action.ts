"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Server action used by the SidebarUserCard's "Sign out" button.
 *
 * Calls better-auth's `signOut` which invalidates the session row + clears
 * the cookie. Any failure is swallowed (we still redirect home) — leaving
 * the user with a 500 here would be worse than re-routing them to a logged-
 * out experience where the cookie has already been cleared client-side.
 */
export async function signOutAction(): Promise<void> {
  try {
    await auth().api.signOut({ headers: await headers() });
  } catch {
    // Session may already be invalid; redirect either way so the user
    // lands on the public surface with a fresh state.
  }
  redirect("/");
}
