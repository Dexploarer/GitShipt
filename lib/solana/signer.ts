import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { serverEnv, hasCredentials } from "@/lib/env";

let _payoutSigner: Keypair | null = null;

/**
 * Lazily decode the hot-wallet payout keypair from env. Throws if absent —
 * callers must guard with `hasCredentials.payoutKey()` for stubbed dev.
 *
 * SECURITY NOTES:
 *  - The keypair env var must be marked Sensitive in Vercel (post-April-2026
 *    incident).
 *  - Production should additionally enforce a daily balance cap on this
 *    wallet; refilled from cold treasury via MFA-gated admin action.
 */
export function payoutSigner(): Keypair {
  if (_payoutSigner) return _payoutSigner;
  const env = serverEnv();
  if (!env.SOLANA_PAYOUT_KEYPAIR) {
    throw new Error(
      "SOLANA_PAYOUT_KEYPAIR is not configured. Set it (base58-encoded) in Vercel as Sensitive.",
    );
  }
  const decoded = bs58.decode(env.SOLANA_PAYOUT_KEYPAIR);
  _payoutSigner = Keypair.fromSecretKey(decoded);
  return _payoutSigner;
}

export function payoutSignerPublicKey(): string | null {
  if (!hasCredentials.payoutKey()) return null;
  return payoutSigner().publicKey.toBase58();
}
