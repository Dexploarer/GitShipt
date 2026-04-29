import nacl from "tweetnacl";
import bs58 from "bs58";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { nanoid } from "nanoid";
import { serverEnv } from "@/lib/env";

/**
 * Sign-In With Solana (SIWS) — minimal in-house verifier.
 *
 * The SIWS standard (analogous to SIWE for Ethereum) builds a deterministic
 * message that the client signs with their wallet via `wallet.signMessage`.
 * Server verifies via Ed25519 signature verification.
 *
 * Why we roll our own: `@phantom/sign-in-with-solana` is not on npm in
 * April 2026, and the message format is small enough to author safely.
 *
 * Nonce safety:
 *   - Generated server-side, stored in Redis with 5-minute TTL keyed by
 *     (address, nonce).
 *   - Single-use: deleted after successful verification.
 *   - Replay across sessions is impossible because the nonce never repeats.
 */

const NONCE_TTL_SECONDS = 5 * 60;

export const SiwsMessageSchema = z.object({
  domain: z.string().min(1),
  address: z.string().min(32).max(44),
  statement: z.string().optional(),
  uri: z.string().url(),
  version: z.literal("1"),
  chainId: z.string().min(1),
  nonce: z.string().min(8),
  issuedAt: z.string().datetime(),
  expirationTime: z.string().datetime().optional(),
  resources: z.array(z.string()).optional(),
});
export type SiwsMessage = z.infer<typeof SiwsMessageSchema>;

const NONCE_KEY = (address: string, nonce: string) => `gitshipt:siws:nonce:${address}:${nonce}`;

/**
 * Generate a fresh nonce and stash it in Redis with a 5min TTL keyed by
 * (address, nonce). Client uses this to construct the message.
 */
export async function issueNonce(address: string): Promise<string> {
  const nonce = nanoid(24);
  const r = redis();
  if (r) {
    await r.set(NONCE_KEY(address, nonce), "1", "EX", NONCE_TTL_SECONDS);
  } else if (serverEnv().NODE_ENV === "production") {
    throw new Error("REDIS_URL is required for SIWS nonce issuance.");
  }
  return nonce;
}

/** Build the canonical message string the client signs. */
export function buildMessage(msg: SiwsMessage): string {
  const validated = SiwsMessageSchema.parse(msg);
  const lines = [
    `${validated.domain} wants you to sign in with your Solana account:`,
    validated.address,
    "",
  ];
  if (validated.statement) {
    lines.push(validated.statement, "");
  }
  lines.push(
    `URI: ${validated.uri}`,
    `Version: ${validated.version}`,
    `Chain ID: ${validated.chainId}`,
    `Nonce: ${validated.nonce}`,
    `Issued At: ${validated.issuedAt}`,
  );
  if (validated.expirationTime) {
    lines.push(`Expiration Time: ${validated.expirationTime}`);
  }
  if (validated.resources?.length) {
    lines.push("Resources:");
    for (const r of validated.resources) lines.push(`- ${r}`);
  }
  return lines.join("\n");
}

export interface VerifyInput {
  message: SiwsMessage;
  signatureBase58: string;
  expectedDomain: string;
  expectedChainId: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  address?: string;
}

/**
 * Verify a SIWS payload end-to-end:
 *   1. Schema-check the message.
 *   2. Confirm `domain` and `chainId` match expected.
 *   3. Confirm the nonce exists in Redis (single-use, 5min TTL).
 *   4. Confirm `issuedAt` is recent and `expirationTime` (if present) hasn't passed.
 *   5. Verify the Ed25519 signature against the address pubkey.
 *   6. Delete the nonce so it cannot be replayed.
 */
export async function verifySiws({
  message,
  signatureBase58,
  expectedDomain,
  expectedChainId,
}: VerifyInput): Promise<VerifyResult> {
  const parsed = SiwsMessageSchema.safeParse(message);
  if (!parsed.success) return { ok: false, reason: "schema" };
  const m = parsed.data;

  if (m.domain !== expectedDomain) return { ok: false, reason: "domain" };
  if (m.chainId !== expectedChainId) return { ok: false, reason: "chainId" };

  const issuedAtMs = Date.parse(m.issuedAt);
  if (!Number.isFinite(issuedAtMs)) return { ok: false, reason: "issuedAt" };
  if (Date.now() - issuedAtMs > 10 * 60_000) return { ok: false, reason: "stale" };
  if (m.expirationTime && Date.parse(m.expirationTime) < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const r = redis();
  if (r) {
    const exists = await r.get(NONCE_KEY(m.address, m.nonce));
    if (!exists) return { ok: false, reason: "nonce" };
  } else if (serverEnv().NODE_ENV === "production") {
    return { ok: false, reason: "redis" };
  }

  let pubkey: Uint8Array;
  let sig: Uint8Array;
  try {
    pubkey = bs58.decode(m.address);
    sig = bs58.decode(signatureBase58);
  } catch {
    return { ok: false, reason: "encoding" };
  }
  if (pubkey.length !== 32) return { ok: false, reason: "pubkey-length" };
  if (sig.length !== 64) return { ok: false, reason: "signature-length" };

  const messageBytes = new TextEncoder().encode(buildMessage(m));
  const valid = nacl.sign.detached.verify(messageBytes, sig, pubkey);
  if (!valid) return { ok: false, reason: "signature" };

  // Single-use: drop the nonce so any replay fails.
  if (r) await r.del(NONCE_KEY(m.address, m.nonce));

  return { ok: true, address: m.address };
}
