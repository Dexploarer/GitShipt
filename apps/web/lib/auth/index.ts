import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { dbPool } from "@/db";
import * as schema from "@/db/schema";
import { serverEnv, hasCredentials } from "@/lib/env";
import { establishDbUserContext, enterDbAnonymousContext } from "@/lib/db-rls";

function adminEmailAllowlist(): Set<string> {
  const raw = serverEnv().ADMIN_EMAIL_ALLOWLIST;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * better-auth instance. Boots lazily so the app can render in stub mode
 * without GitHub OAuth credentials configured.
 *
 * Notes:
 *  - We use the pool driver (drizzle-orm/neon-serverless) here so multi-step
 *    auth flows (e.g. account-linking + session) run inside one transaction.
 *  - Session cookies are HttpOnly + Secure + SameSite=Lax (better-auth defaults).
 *  - GitHub access tokens are persisted in `accounts.access_token` for use
 *    by Octokit when the user-context API surface is needed.
 *
 * Type holes: `_authCache` is loosely typed because better-auth's return
 * type narrows on `additionalFields`, which is awkward to express in a
 * cache slot. We cast on read; the runtime shape is unchanged.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _authCache: any = null;

function buildOptions(): BetterAuthOptions {
  const env = serverEnv();
  if (env.NODE_ENV === "production" && !env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }
  return {
    database: drizzleAdapter(dbPool(), {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    secret:
      env.BETTER_AUTH_SECRET ??
      "dev-only-32-byte-secret-do-not-use-in-prod-1234",
    baseURL:
      env.BETTER_AUTH_URL ??
      (env.NODE_ENV === "production" ? undefined : "http://localhost:3000"),
    socialProviders: hasCredentials.github()
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID!,
            clientSecret: env.GITHUB_CLIENT_SECRET!,
            // `read:org` is required for `apps.listInstallationsForAuthenticatedUser`
            // to enumerate org installations the user is a member of.
            // Personal-account installations work without it; org ones don't.
            scope: ["read:user", "user:email", "read:org"],
          },
        }
      : {},
    user: {
      additionalFields: {
        githubId: { type: "string", required: false },
        githubUsername: { type: "string", required: false },
        role: { type: "string", required: true, defaultValue: "user" },
      },
    },
    advanced: {
      cookies: {
        sessionToken: {
          attributes: { sameSite: "lax", secure: true, httpOnly: true },
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const email = (user as { email?: string }).email;
            if (!email) return;
            if (!adminEmailAllowlist().has(email.toLowerCase())) return;
            await dbPool()
              .update(schema.users)
              .set({ role: "super_admin" })
              .where(eq(schema.users.id, (user as { id: string }).id));
          },
        },
      },
    },
  } satisfies BetterAuthOptions;
}

export function auth(): ReturnType<typeof betterAuth> {
  if (_authCache) return _authCache;
  const instance = betterAuth(buildOptions());
  const originalGetSession = instance.api.getSession.bind(instance.api);
  instance.api.getSession = (async (
    ...args: Parameters<typeof originalGetSession>
  ) => {
    const session = await originalGetSession(...args);
    if (session?.user?.id) {
      await establishDbUserContext(session.user.id, "better-auth-session");
    } else {
      enterDbAnonymousContext("better-auth-empty-session");
    }
    return session;
  }) as typeof originalGetSession;
  _authCache = instance;
  return _authCache;
}

export type Auth = ReturnType<typeof auth>;
