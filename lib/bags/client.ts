import { serverEnv, hasCredentials } from "@/lib/env";
import {
  TokenInfoInputSchema,
  TokenInfoResponseSchema,
  FeeShareConfigInputSchema,
  FeeShareConfigResponseSchema,
  ResolvedWalletSchema,
  ClaimablePositionsResponseSchema,
  LifetimeFeesSchema,
  type TokenInfoInput,
  type TokenInfoResponse,
  type FeeShareConfigInput,
  type FeeShareConfigResponse,
  type ResolvedWallet,
  type ClaimablePositionsResponse,
  type LifetimeFees,
  type BagsProvider,
} from "./types";
import { stubBags } from "./__stubs";

/**
 * Typed Bags.fm client. Behavior:
 *   - When BAGS_API_KEY is present: instantiates @bagsfm/bags-sdk (lazy,
 *     dynamic import to avoid bundling Solana into RSC payloads) AND falls
 *     back to direct REST calls for endpoints that aren't in the SDK.
 *   - When absent: returns deterministic stubs with `__stub: true`.
 *
 * Every response is Zod-validated before returning to callers — never trust
 * Bags shape across version drift.
 */

type BagsSdk = unknown; // resolved at runtime via dynamic import

let _sdk: BagsSdk | null = null;

const DEMO_TOKEN_MINT = "GBAGSdemoTokenMint11111111111111111111111111";
const STUB_TOKEN_SUFFIX = "ags1111111111111111111111111111111111111";

function isPlaceholderTokenMint(tokenMint: string): boolean {
  return tokenMint === DEMO_TOKEN_MINT || tokenMint.endsWith(STUB_TOKEN_SUFFIX);
}

async function getSdk(): Promise<BagsSdk> {
  if (_sdk) return _sdk;
  const env = serverEnv();
  if (!env.BAGS_API_KEY) {
    throw new Error("BAGS_API_KEY is required for live Bags calls.");
  }
  if (!env.HELIUS_RPC_URL) {
    throw new Error("HELIUS_RPC_URL is required for Bags SDK.");
  }
  const [{ BagsSDK }, { Connection }] = await Promise.all([
    import("@bagsfm/bags-sdk"),
    import("@solana/web3.js"),
  ]);
  const conn = new Connection(env.HELIUS_RPC_URL, "processed");
  _sdk = new BagsSDK(env.BAGS_API_KEY, conn, "processed");
  return _sdk;
}

async function bagsRest<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<T> {
  const env = serverEnv();
  if (!env.BAGS_API_KEY) {
    throw new Error("BAGS_API_KEY is required for REST calls.");
  }
  const url = new URL(path, env.BAGS_API_BASE_URL);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      "x-api-key": env.BAGS_API_KEY,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bags ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

export const bags = {
  hasCredentials: hasCredentials.bags,

  /** Step 1 of launch: upload metadata, get tokenMint + metadata URL. */
  async createTokenInfo(input: TokenInfoInput): Promise<TokenInfoResponse> {
    const validated = TokenInfoInputSchema.parse(input);
    if (!hasCredentials.bags()) {
      return TokenInfoResponseSchema.parse(stubBags.tokenInfo(validated.symbol));
    }
    const sdk = (await getSdk()) as {
      tokenLaunch: {
        createTokenInfo: (i: TokenInfoInput) => Promise<{
          tokenMint: string;
          tokenMetadata: string;
        }>;
      };
    };
    const raw = await sdk.tokenLaunch.createTokenInfo(validated);
    return TokenInfoResponseSchema.parse(raw);
  },

  /** Step 2 of launch: register fee-share config (claimers + share_fee). */
  async createFeeShareConfig(
    input: FeeShareConfigInput,
  ): Promise<FeeShareConfigResponse> {
    const validated = FeeShareConfigInputSchema.parse(input);
    if (!hasCredentials.bags()) {
      return FeeShareConfigResponseSchema.parse(stubBags.feeShareConfig());
    }
    const sdk = (await getSdk()) as {
      tokenLaunch: {
        feeShare: {
          createConfig: (i: {
            payer: string;
            baseMint: string;
            feeClaimers: typeof validated.feeClaimers;
            share_fee: number;
          }) => Promise<{ configKey: string }>;
        };
      };
    };
    // Use snake_case `share_fee` per current SDK shape (verify against live types).
    const raw = await sdk.tokenLaunch.feeShare.createConfig({
      payer: validated.payer,
      baseMint: validated.baseMint,
      feeClaimers: validated.feeClaimers,
      share_fee: validated.shareFee,
    });
    return FeeShareConfigResponseSchema.parse(raw);
  },

  /**
   * Resolve `provider` + `username` to a Bags-routed wallet address.
   * Used at launch (to know the platform-pool address) and during onboarding
   * (to validate that a fee claimer can be configured for a contributor).
   */
  async resolveWallet(provider: BagsProvider, username: string): Promise<ResolvedWallet> {
    if (!hasCredentials.bags()) {
      return ResolvedWalletSchema.parse(stubBags.resolvedWallet(provider, username));
    }
    const raw = await bagsRest<{ success: boolean; response: ResolvedWallet }>(
      "token-launch/fee-share/wallet/v2",
      { query: { provider, username } },
    );
    return ResolvedWalletSchema.parse(raw.response);
  },

  /** Read claimable lamports per token-mint position for a given wallet. */
  async getClaimablePositions(walletAddress: string): Promise<ClaimablePositionsResponse> {
    if (!hasCredentials.bags()) {
      return ClaimablePositionsResponseSchema.parse(
        stubBags.claimablePositions("StubMint11111111111111111111111111111111111"),
      );
    }
    const raw = await bagsRest<unknown>("token-launch/claimable-positions", {
      query: { wallet: walletAddress },
    });
    // The endpoint returns an array; wrap for Zod.
    const positions = Array.isArray(raw) ? raw : (raw as { data?: unknown }).data ?? [];
    return ClaimablePositionsResponseSchema.parse({ positions });
  },

  /** Aggregate lifetime fee total for a token. Used on the project page. */
  async getLifetimeFees(tokenMint: string): Promise<LifetimeFees> {
    if (!hasCredentials.bags() || isPlaceholderTokenMint(tokenMint)) {
      return LifetimeFeesSchema.parse(stubBags.lifetimeFees(tokenMint));
    }
    const raw = await bagsRest<unknown>("token-launch/lifetime-fees", {
      query: { tokenMint },
    });
    return LifetimeFeesSchema.parse(raw);
  },

  /**
   * Get an array of unsigned VersionedTransactions to claim accrued fees
   * on behalf of `walletAddress` for `tokenMint`. Caller signs + sends.
   * Throws when stubbed — payout dispatch must be guarded.
   */
  async getClaimTransactions(
    walletAddress: string,
    tokenMint: string,
  ): Promise<{ transactions: unknown[]; __stub?: boolean }> {
    if (!hasCredentials.bags()) {
      return { transactions: [], __stub: true };
    }
    const sdk = (await getSdk()) as {
      fee: {
        getClaimTransactions: (
          wallet: unknown,
          mint: unknown,
        ) => Promise<unknown[]>;
      };
    };
    const { PublicKey } = await import("@solana/web3.js");
    const transactions = await sdk.fee.getClaimTransactions(
      new PublicKey(walletAddress),
      new PublicKey(tokenMint),
    );
    return { transactions };
  },
};

export type BagsClient = typeof bags;
