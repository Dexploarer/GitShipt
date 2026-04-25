import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: z.string().url().optional(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  // Redis (Upstash)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Bags.fm
  BAGS_API_KEY: z.string().min(1).optional(),
  BAGS_API_BASE_URL: z.string().url().default("https://public-api-v2.bags.fm/api/v1/"),
  BAGS_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Solana
  HELIUS_RPC_URL: z.string().url().optional(),
  SOLANA_PAYOUT_KEYPAIR: z.string().min(1).optional(),
  SOLANA_TREASURY_ADDRESS: z.string().min(32).optional(),

  // Cron
  CRON_SECRET: z.string().min(16).optional(),

  // Platform
  PLATFORM_FEE_BPS_DEFAULT: z.coerce.number().int().min(0).max(2000).default(500),
  ADMIN_EMAIL_ALLOWLIST: z.string().optional(),
  KILL_SWITCH_ENABLED: z.coerce.boolean().default(false),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SOLANA_CLUSTER: z.enum(["devnet", "testnet", "mainnet-beta"]).default("devnet"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedServer: ServerEnv | null = null;
let cachedClient: ClientEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cachedServer) return cachedServer;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("[env] Server env validation failed:", parsed.error.flatten());
    throw new Error("Invalid server environment");
  }
  cachedServer = parsed.data;
  return cachedServer;
}

export function clientEnv(): ClientEnv {
  if (cachedClient) return cachedClient;
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
  });
  if (!parsed.success) {
    console.error("[env] Client env validation failed:", parsed.error.flatten());
    throw new Error("Invalid client environment");
  }
  cachedClient = parsed.data;
  return cachedClient;
}

/**
 * Cheap helper: are we configured to call a given external service?
 * Used by stub-flippable clients (Bags, Helius, GitHub App) to decide between
 * live calls and deterministic stubs.
 */
export const hasCredentials = {
  db: () => Boolean(serverEnv().DATABASE_URL),
  redis: () =>
    Boolean(serverEnv().UPSTASH_REDIS_REST_URL && serverEnv().UPSTASH_REDIS_REST_TOKEN),
  github: () => Boolean(serverEnv().GITHUB_CLIENT_ID && serverEnv().GITHUB_CLIENT_SECRET),
  githubApp: () =>
    Boolean(
      serverEnv().GITHUB_APP_ID &&
        serverEnv().GITHUB_APP_PRIVATE_KEY &&
        serverEnv().GITHUB_APP_WEBHOOK_SECRET,
    ),
  bags: () => Boolean(serverEnv().BAGS_API_KEY),
  solana: () => Boolean(serverEnv().HELIUS_RPC_URL),
  payoutKey: () => Boolean(serverEnv().SOLANA_PAYOUT_KEYPAIR),
  cron: () => Boolean(serverEnv().CRON_SECRET),
};
