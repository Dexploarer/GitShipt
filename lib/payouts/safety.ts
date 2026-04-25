import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hasCredentials } from "@/lib/env";
import { solanaConnection } from "@/lib/solana/connection";
import { payoutSigner } from "@/lib/solana/signer";

/**
 * Hardcoded safety thresholds. Override per-deploy via
 * `platform_config['payouts.balance_cap_lamports']` etc. (see below).
 */
export const MIN_HOT_BALANCE_LAMPORTS = 500_000_000n; // 0.5 SOL
export const MAX_HOT_BALANCE_LAMPORTS = 50_000_000_000n; // 50 SOL sanity cap
export const MAX_CYCLE_LAMPORTS = 50_000_000_000n; // 50 SOL per cycle

/**
 * Reads a numeric/bigint safety cap from platform_config, falling back to
 * the supplied default when the key is missing or malformed.
 */
async function readBigintConfig(key: string, fallback: bigint): Promise<bigint> {
  const [row] = await dbHttp
    .select({ value: platformConfig.value })
    .from(platformConfig)
    .where(eq(platformConfig.key, key))
    .limit(1);
  if (!row) return fallback;
  const v = (row.value as { value?: unknown }).value;
  if (typeof v === "string") {
    try {
      return BigInt(v);
    } catch {
      return fallback;
    }
  }
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return BigInt(Math.floor(v));
  }
  return fallback;
}

/** Read kill_switch.global from platform_config. */
export async function isKillSwitchEnabled(): Promise<boolean> {
  const [row] = await dbHttp
    .select({ value: platformConfig.value })
    .from(platformConfig)
    .where(eq(platformConfig.key, "kill_switch.global"))
    .limit(1);
  if (!row) return false;
  const enabled = (row.value as { enabled?: unknown }).enabled;
  return enabled === true;
}

/** Returns hot wallet balance in lamports. Returns 0n when not configured. */
export async function getHotWalletBalance(): Promise<bigint> {
  if (!hasCredentials.payoutKey() || !hasCredentials.solana()) return 0n;
  const conn = solanaConnection("confirmed");
  const lamports = await conn.getBalance(payoutSigner().publicKey);
  return BigInt(lamports);
}

export interface SnapshotContextLike {
  snapshot: { id: string; status: string; totalFeesLamports: bigint };
  project: { id: string; status: string; tokenMint: string | null };
}

export type PreflightResult =
  | { ok: true; balance: bigint; minBalance: bigint; maxBalance: bigint }
  | { ok: false; reason: string };

/**
 * Snapshot-payout preflight: kill switch off, snapshot frozen, project live,
 * hot wallet within balance bounds. Used as the gate before claiming Bags fees.
 */
export async function preflightSafety(
  ctx: SnapshotContextLike,
): Promise<PreflightResult> {
  if (await isKillSwitchEnabled()) {
    return { ok: false, reason: "kill_switch_enabled" };
  }
  if (ctx.snapshot.status !== "frozen") {
    return { ok: false, reason: `snapshot_status=${ctx.snapshot.status}` };
  }
  if (ctx.project.status !== "live") {
    return { ok: false, reason: `project_status=${ctx.project.status}` };
  }

  const minBalance = await readBigintConfig(
    "payouts.min_balance_lamports",
    MIN_HOT_BALANCE_LAMPORTS,
  );
  const maxBalance = await readBigintConfig(
    "payouts.balance_cap_lamports",
    MAX_HOT_BALANCE_LAMPORTS,
  );

  // If we have no signer/connection at all, treat balance as 0 — caller will
  // fall through to stub mode (which doesn't transfer SOL).
  const balance = await getHotWalletBalance();

  if (hasCredentials.payoutKey()) {
    if (balance < minBalance) {
      return { ok: false, reason: `hot_balance_too_low:${balance.toString()}` };
    }
    if (balance > maxBalance) {
      return { ok: false, reason: `hot_balance_too_high:${balance.toString()}` };
    }
  }

  return { ok: true, balance, minBalance, maxBalance };
}

/** Cycle cap check: refuse to dispatch if total > MAX_CYCLE_LAMPORTS. */
export async function getCycleCap(): Promise<bigint> {
  return readBigintConfig("payouts.cycle_cap_lamports", MAX_CYCLE_LAMPORTS);
}
