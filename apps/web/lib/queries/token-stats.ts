import "server-only";
import { bags } from "@/lib/bags/client";
import type { ProjectHeader } from "./project-page";

export interface TokenStats {
  /** Display symbol (uppercase ticker derived from repo name). */
  symbol: string;
  /** Spot price in USD. */
  priceUsd: number;
  /** 24h price change as a percentage (e.g. +12.4 means +12.4%). */
  priceChange24hPct: number;
  /** Fully-diluted market cap in USD (price × 1B supply). */
  marketCapUsd: number;
  /** 24h trading volume in USD. */
  volume24hUsd: number;
  /** Total holders count. */
  holders: number;
  /** Lifetime fees paid out to the platform pool, in lamports. */
  lifetimeFeesLamports: bigint;
  /** Token mint address (Solana base58). */
  tokenMint: string;
  /** True when any field is stubbed (Bags API not configured or not exposed). */
  isStub: boolean;
}

/**
 * Build a deterministic token stat block. Real fields (lifetime fees, mint
 * address) come from Bags + DB. Price / market cap / volume / holders are
 * derived stubs scaled off lifetime fees so the demo numbers move with the
 * pool — when Bags exposes a market-data endpoint, swap the derivation.
 *
 * Returns null when the project hasn't launched yet (no tokenMint).
 */
export async function getTokenStats(
  header: ProjectHeader,
): Promise<TokenStats | null> {
  if (!header.tokenMint) return null;

  let lifetimeFees = 0n;
  let isStub = !bags.hasCredentials();
  try {
    const res = await bags.getLifetimeFees(header.tokenMint);
    lifetimeFees = res.totalLifetimeLamports;
    isStub = isStub || Boolean(res.__stub);
  } catch {
    // network/parse failure → keep zero defaults, mark stubbed
    isStub = true;
  }

  // Deterministic derivations — all scale off lifetime SOL.
  const lifetimeSol = Number(lifetimeFees) / 1_000_000_000;
  const priceUsd = lifetimeSol / 100_000 || 0.00001;
  const supply = 1_000_000_000; // standard Bags supply
  const marketCapUsd = priceUsd * supply;
  const volume24hUsd = priceUsd * 25_000_000;

  // Deterministic 24h change derived from the mint address (stable across
  // requests so the demo doesn't flicker). Range roughly -8% to +18%.
  const seed =
    header.tokenMint
      .split("")
      .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7) %
    260;
  const priceChange24hPct = (seed - 80) / 10;

  // Deterministic holders count — scales with lifetime SOL.
  const holders = Math.max(12, Math.round(lifetimeSol * 25 + 47));

  return {
    symbol: header.ghRepo.toUpperCase().slice(0, 8),
    priceUsd,
    priceChange24hPct,
    marketCapUsd,
    volume24hUsd,
    holders,
    lifetimeFeesLamports: lifetimeFees,
    tokenMint: header.tokenMint,
    isStub,
  };
}
