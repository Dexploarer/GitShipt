import type {
  TokenInfoResponse,
  FeeShareConfigResponse,
  ResolvedWallet,
  ClaimablePositionsResponse,
  LifetimeFees,
} from "./types";

const FAKE_PUBKEY = "GitBags1111111111111111111111111111111111111";

/**
 * Deterministic fakes used when BAGS_API_KEY is absent. Every response is
 * tagged `__stub: true` so callers can detect dev mode and downstream code
 * (e.g. payout dispatch) can refuse to send real on-chain transfers.
 */
export const stubBags = {
  tokenInfo(symbol: string): TokenInfoResponse {
    const tokenMint = `${symbol.padEnd(4, "X").slice(0, 4)}${FAKE_PUBKEY.slice(4)}`;
    return {
      tokenMint,
      tokenMetadata: `https://stub.gitbags.local/metadata/${tokenMint}.json`,
      __stub: true,
    };
  },

  feeShareConfig(): FeeShareConfigResponse {
    return {
      configKey: `Cfg${FAKE_PUBKEY.slice(3)}`,
      __stub: true,
    };
  },

  resolvedWallet(provider: string, username: string): ResolvedWallet {
    return {
      provider: provider as ResolvedWallet["provider"],
      platformData: {
        id: `stub-${username}`,
        username,
        display_name: username,
        avatar_url: null,
      },
      wallet: FAKE_PUBKEY,
      __stub: true,
    };
  },

  claimablePositions(tokenMint: string): ClaimablePositionsResponse {
    return {
      positions: [
        {
          baseMint: tokenMint,
          totalClaimableLamportsUserShare: 5_000_000_000n, // 5 SOL of "fees"
          virtualPoolClaimableLamportsUserShare: 5_000_000_000n,
          dammPoolClaimableLamportsUserShare: 0n,
          isMigrated: false,
        },
      ],
      __stub: true,
    };
  },

  lifetimeFees(tokenMint: string): LifetimeFees {
    return {
      tokenMint,
      totalLifetimeLamports: 124_500_000_000n,
      totalLifetimeUsd: 21_375.0,
      __stub: true,
    };
  },
};
