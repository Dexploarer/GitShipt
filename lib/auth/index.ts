import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { dbPool } from "@/db";
import * as schema from "@/db/schema";
import { serverEnv, hasCredentials } from "@/lib/env";

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
            scope: ["read:user", "user:email"],
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
  } satisfies BetterAuthOptions;
}

export function auth(): ReturnType<typeof betterAuth> {
  if (_authCache) return _authCache;
  _authCache = betterAuth(buildOptions());
  return _authCache;
}

export type Auth = ReturnType<typeof auth>;
