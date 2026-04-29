"use client";

import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

/**
 * Client-side Supabase Auth wrapper.
 *
 * Used by signin pages and any client-side session checks.
 * Most auth checks should happen on the server.
 */

const supabase = createClient();

/**
 * Signs in with GitHub OAuth.
 * Redirects to GitHub for authentication.
 */
export async function signInWithGitHub(redirectTo?: string) {
  const callbackUrl =
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
    `${window.location.origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: callbackUrl,
      scopes: "read:user user:email",
      queryParams: redirectTo
        ? { next: redirectTo }
        : undefined,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Signs out the current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/**
 * Gets the current session on the client.
 * Prefer server-side checks when possible.
 */
export async function getClientSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

/**
 * Gets the current user on the client.
 * Validates with Supabase server - more secure than getSession().
 */
export async function getClientUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

/**
 * Subscribes to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (user: SupabaseUser | null) => void,
) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}

// Export the supabase client for advanced use cases
export { supabase };
