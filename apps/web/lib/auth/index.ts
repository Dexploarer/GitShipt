import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { User as SupabaseUser } from "@supabase/supabase-js";

/**
 * Supabase Auth module.
 *
 * Provides session management through Supabase Auth with GitHub OAuth as the
 * primary sign-in method. The Supabase user maps to `auth.users` in the
 * Supabase-managed schema, while app-specific fields (role, githubUsername)
 * live in `public.profiles`.
 */

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  githubId: string | null;
  githubUsername: string | null;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

/**
 * Extracts GitHub identity from Supabase user metadata.
 * GitHub provider stores identity in `user.identities` array and `user_metadata`.
 */
function extractGitHubIdentity(user: SupabaseUser): {
  githubId: string | null;
  githubUsername: string | null;
} {
  const githubIdentity = user.identities?.find(
    (identity) => identity.provider === "github",
  );

  // GitHub username comes from user_metadata (set by Supabase on OAuth)
  const githubUsername =
    (user.user_metadata?.user_name as string | undefined) ??
    (user.user_metadata?.preferred_username as string | undefined) ??
    null;

  return {
    githubId: githubIdentity?.provider_id ?? null,
    githubUsername,
  };
}

/**
 * Maps Supabase user to our AuthUser interface.
 */
function toAuthUser(user: SupabaseUser): AuthUser {
  const { githubId, githubUsername } = extractGitHubIdentity(user);

  return {
    id: user.id,
    email: user.email ?? null,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    image: user.user_metadata?.avatar_url ?? null,
    githubId,
    githubUsername,
  };
}

/**
 * Gets the current session. Returns null if not authenticated.
 * Use this for optional auth checks.
 */
export async function getSession(): Promise<AuthSession | null> {
  const supabase = await createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return null;
  }

  return {
    user: toAuthUser(session.user),
    accessToken: session.access_token,
  };
}

/**
 * Gets the current user. More secure than getSession() as it validates
 * the session with the Supabase server.
 * Returns null if not authenticated.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return toAuthUser(user);
}

/**
 * Signs out the current user.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// Re-export types for convenience
export type { SupabaseUser };
