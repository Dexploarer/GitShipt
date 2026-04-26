import { z } from "zod";

export const DEFAULT_BAGS_PARTNER_WALLET =
  "HXs58Qa6YtgJfWVkQVnpFmw6WoEdFEL4LLD1ArZjMvTH";
export const DEFAULT_BAGS_REF_CODE = "symbiex";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database
  DATABASE_URL: z.string().url().optional(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  // Redis (any provider speaking standard Redis protocol — Redis Cloud,
  // Upstash, Dragonfly, self-hosted). Format: redis://[user]:[pass]@host:port
  REDIS_URL: z.string().optional(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1).optional(),
  GITHUB_APP_SLUG: z.string().min(1).optional(),

  // Bags.fm
  BAGS_API_KEY: z.string().min(1).optional(),
  BAGS_API_BASE_URL: z
    .string()
    .url()
    .default("https://public-api-v2.bags.fm/api/v1/"),
  BAGS_WEBHOOK_SECRET: z.string().min(1).optional(),
  BAGS_PARTNER_WALLET: z
    .string()
    .min(32)
    .default(DEFAULT_BAGS_PARTNER_WALLET),
  BAGS_PARTNER_CONFIG_KEY: z.string().min(32).optional(),
  BAGS_REF_CODE: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .default(DEFAULT_BAGS_REF_CODE),
  BAGS_CONFIG_TYPE: z.string().min(1).optional(),
  BAGS_INITIAL_BUY_LAMPORTS: z.coerce.number().int().min(0).default(0),
  // Safety guard: refuse real launch txns when devnet cluster + prod key
  // unless explicitly opted in. Read-only Bags calls always work.
  BAGS_ALLOW_PROD_LAUNCH: z.coerce.boolean().default(false),
  ALLOW_STUBS_IN_PROD: z.coerce.boolean().default(false),

  // Solana
  HELIUS_RPC_URL: z.string().url().optional(),
  SOLANA_PAYOUT_KEYPAIR: z.string().min(1).optional(),
  SOLANA_TREASURY_ADDRESS: z.string().min(32).optional(),

  // Cron
  CRON_SECRET: z.string().min(16).optional(),

  // Platform
  PLATFORM_FEE_BPS_DEFAULT: z.coerce
    .number()
    .int()
    .min(0)
    .max(2000)
    .default(500),
  ADMIN_EMAIL_ALLOWLIST: z.string().optional(),
  KILL_SWITCH_ENABLED: z.coerce.boolean().default(false),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SOLANA_CLUSTER: z
    .enum(["devnet", "testnet", "mainnet-beta"])
    .default("devnet"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedServer: ServerEnv | null = null;
let cachedClient: ClientEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cachedServer) return cachedServer;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "[env] Server env validation failed:",
      parsed.error.flatten(),
    );
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
    console.error(
      "[env] Client env validation failed:",
      parsed.error.flatten(),
    );
    throw new Error("Invalid client environment");
  }
  cachedClient = parsed.data;
  return cachedClient;
}

export const hasCredentials = {
  db: () => Boolean(serverEnv().DATABASE_URL),
  redis: () => Boolean(serverEnv().REDIS_URL),
  github: () =>
    Boolean(serverEnv().GITHUB_CLIENT_ID && serverEnv().GITHUB_CLIENT_SECRET),
  githubApp: () =>
    Boolean(
      serverEnv().GITHUB_APP_ID &&
      serverEnv().GITHUB_APP_PRIVATE_KEY &&
      serverEnv().GITHUB_APP_WEBHOOK_SECRET,
    ),
  bags: () => Boolean(serverEnv().BAGS_API_KEY),
  bagsPartner: () => Boolean(serverEnv().BAGS_PARTNER_WALLET),
  solana: () => Boolean(serverEnv().HELIUS_RPC_URL),
  payoutKey: () => Boolean(serverEnv().SOLANA_PAYOUT_KEYPAIR),
  cron: () => Boolean(serverEnv().CRON_SECRET),
};

export function stubsAllowed(): boolean {
  const env = serverEnv();
  return env.NODE_ENV !== "production" || env.ALLOW_STUBS_IN_PROD;
}

/**
 * Safety check: should we allow a real Bags launch transaction?
 * Refuses when the cluster is devnet AND the key looks production-y,
 * unless BAGS_ALLOW_PROD_LAUNCH=true is explicitly set.
 */
export function canLaunchOnBags():
  | { ok: true }
  | { ok: false; reason: string } {
  const env = serverEnv();
  if (!env.BAGS_API_KEY) return { ok: false, reason: "BAGS_API_KEY missing" };
  if (!env.HELIUS_RPC_URL)
    return { ok: false, reason: "HELIUS_RPC_URL missing" };
  if (!env.SOLANA_PAYOUT_KEYPAIR) {
    return { ok: false, reason: "SOLANA_PAYOUT_KEYPAIR missing" };
  }
  const cluster = clientEnv().NEXT_PUBLIC_SOLANA_CLUSTER;
  const isProdKey = env.BAGS_API_KEY.startsWith("bags_prod_");
  if (cluster !== "mainnet-beta" && isProdKey && !env.BAGS_ALLOW_PROD_LAUNCH) {
    return {
      ok: false,
      reason:
        "Refusing prod-key launch on non-mainnet cluster. Set BAGS_ALLOW_PROD_LAUNCH=true to override.",
    };
  }
  return { ok: true };
}

export interface ProductionReadiness {
  ok: boolean;
  mode: "production" | "non-production";
  missing: string[];
  warnings: string[];
  cluster: ClientEnv["NEXT_PUBLIC_SOLANA_CLUSTER"];
  bagsApiBaseUrl: string;
  partnerWalletConfigured: boolean;
  refCode: string;
}

export function productionReadiness(): ProductionReadiness {
  const env = serverEnv();
  const publicEnv = clientEnv();
  const missing: string[] = [];
  const warnings: string[] = [];

  if (env.NODE_ENV !== "production") {
    return {
      ok: true,
      mode: "non-production",
      missing,
      warnings,
      cluster: publicEnv.NEXT_PUBLIC_SOLANA_CLUSTER,
      bagsApiBaseUrl: env.BAGS_API_BASE_URL,
      partnerWalletConfigured: Boolean(env.BAGS_PARTNER_WALLET),
      refCode: env.BAGS_REF_CODE,
    };
  }

  const requiredServer: Array<[string, unknown]> = [
    ["DATABASE_URL", env.DATABASE_URL],
    ["REDIS_URL", env.REDIS_URL],
    ["BETTER_AUTH_SECRET", env.BETTER_AUTH_SECRET],
    ["BETTER_AUTH_URL", env.BETTER_AUTH_URL],
    ["GITHUB_CLIENT_ID", env.GITHUB_CLIENT_ID],
    ["GITHUB_CLIENT_SECRET", env.GITHUB_CLIENT_SECRET],
    ["GITHUB_APP_ID", env.GITHUB_APP_ID],
    ["GITHUB_APP_PRIVATE_KEY", env.GITHUB_APP_PRIVATE_KEY],
    ["GITHUB_APP_WEBHOOK_SECRET", env.GITHUB_APP_WEBHOOK_SECRET],
    ["BAGS_API_KEY", env.BAGS_API_KEY],
    ["BAGS_WEBHOOK_SECRET", env.BAGS_WEBHOOK_SECRET],
    ["BAGS_PARTNER_WALLET", env.BAGS_PARTNER_WALLET],
    ["HELIUS_RPC_URL", env.HELIUS_RPC_URL],
    ["SOLANA_PAYOUT_KEYPAIR", env.SOLANA_PAYOUT_KEYPAIR],
    ["CRON_SECRET", env.CRON_SECRET],
  ];

  for (const [name, value] of requiredServer) {
    if (!value) missing.push(name);
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    missing.push("NEXT_PUBLIC_APP_URL");
  } else if (publicEnv.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    warnings.push("NEXT_PUBLIC_APP_URL points at localhost.");
  }

  if (publicEnv.NEXT_PUBLIC_SOLANA_CLUSTER !== "mainnet-beta") {
    missing.push("NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta");
  }

  if (env.ALLOW_STUBS_IN_PROD) {
    warnings.push("ALLOW_STUBS_IN_PROD=true leaves production in stub mode.");
  }

  if (env.BAGS_API_KEY && !env.BAGS_API_KEY.startsWith("bags_prod_")) {
    warnings.push("BAGS_API_KEY does not look like a production key.");
  }

  if (!env.BAGS_API_BASE_URL.startsWith("https://public-api-v2.bags.fm/")) {
    warnings.push("BAGS_API_BASE_URL is not the canonical public API host.");
  }

  return {
    ok: missing.length === 0 && warnings.length === 0,
    mode: "production",
    missing,
    warnings,
    cluster: publicEnv.NEXT_PUBLIC_SOLANA_CLUSTER,
    bagsApiBaseUrl: env.BAGS_API_BASE_URL,
    partnerWalletConfigured: Boolean(env.BAGS_PARTNER_WALLET),
    refCode: env.BAGS_REF_CODE,
  };
}
