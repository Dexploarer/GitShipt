import { serverEnv, hasCredentials, canLaunchOnBags } from "@/lib/env";
import { payoutSigner } from "@/lib/solana/signer";
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

type BagsSdk = {
  tokenLaunch: {
    createTokenInfoAndMetadata: (input: {
      name: string;
      symbol: string;
      description: string;
      imageUrl: string;
    }) => Promise<{
      tokenMint: string;
      tokenMetadata: string;
    }>;
  };
  state: {
    getConnection: () => unknown;
    getLaunchWalletV2Bulk: (
      items: Array<{ username: string; provider: BagsProvider }>,
    ) => Promise<
      Array<{
        username: string;
        provider: string;
        wallet: unknown | null;
        platformData: unknown | null;
      }>
    >;
  };
  config: {
    createBagsFeeShareConfig: (input: {
      payer: unknown;
      baseMint: unknown;
      feeClaimers: Array<{ user: unknown; userBps: number }>;
      partner?: unknown;
      partnerConfig?: unknown;
      bagsConfigType?: string;
    }) => Promise<{
      transactions?: unknown[];
      bundles?: unknown[][];
      meteoraConfigKey: unknown;
    }>;
  };
  fee: {
    getAllClaimablePositions: (wallet: unknown) => Promise<unknown[]>;
    getClaimTransactions: (
      wallet: unknown,
      mint: unknown,
    ) => Promise<unknown[]>;
  };
};

type BagsSdkModule = {
  BagsSDK: new (
    apiKey: string,
    connection: unknown,
    commitment: "processed",
  ) => BagsSdk;
  signAndSendTransaction: (
    connection: unknown,
    commitment: "processed",
    transaction: unknown,
    keypair: unknown,
  ) => Promise<string>;
};

let _sdk: BagsSdk | null = null;
let _sdkModule: BagsSdkModule | null = null;

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
  const [sdkModule, { Connection }] = await Promise.all([
    import("@bagsfm/bags-sdk"),
    import("@solana/web3.js"),
  ]);
  _sdkModule = sdkModule as BagsSdkModule;
  const conn = new Connection(env.HELIUS_RPC_URL, "processed");
  _sdk = new _sdkModule.BagsSDK(env.BAGS_API_KEY, conn, "processed");
  return _sdk;
}

async function getSdkModule(): Promise<BagsSdkModule> {
  if (_sdkModule) return _sdkModule;
  await getSdk();
  if (!_sdkModule) throw new Error("Bags SDK failed to initialize.");
  return _sdkModule;
}

function shouldUseStubLaunch(): boolean {
  return !hasCredentials.bags() || !canLaunchOnBags().ok;
}

function publicKeyToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toBase58" in value &&
    typeof value.toBase58 === "function"
  ) {
    return value.toBase58();
  }
  return String(value);
}

function addFeeClaimer(
  claimers: Map<string, number>,
  wallet: string,
  bps: number,
): void {
  if (bps <= 0) return;
  claimers.set(wallet, (claimers.get(wallet) ?? 0) + bps);
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
    throw new Error(
      `Bags ${res.status} ${res.statusText}: ${body.slice(0, 500)}`,
    );
  }
  return (await res.json()) as T;
}

export const bags = {
  hasCredentials: hasCredentials.bags,

  /** Step 1 of launch: upload metadata, get tokenMint + metadata URL. */
  async createTokenInfo(input: TokenInfoInput): Promise<TokenInfoResponse> {
    const validated = TokenInfoInputSchema.parse(input);
    if (shouldUseStubLaunch()) {
      return TokenInfoResponseSchema.parse(
        stubBags.tokenInfo(validated.symbol),
      );
    }
    const sdk = await getSdk();
    const raw = await sdk.tokenLaunch.createTokenInfoAndMetadata({
      ...validated,
      description: validated.description ?? "",
    });
    return TokenInfoResponseSchema.parse(raw);
  },

  /** Step 2 of launch: register fee-share config using Bags Fee Share v2. */
  async createFeeShareConfig(
    input: FeeShareConfigInput,
  ): Promise<FeeShareConfigResponse> {
    const validated = FeeShareConfigInputSchema.parse(input);
    if (shouldUseStubLaunch()) {
      return FeeShareConfigResponseSchema.parse(stubBags.feeShareConfig());
    }
    const env = serverEnv();
    const [{ PublicKey }, sdk, sdkModule] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
      getSdkModule(),
    ]);

    const resolved = await sdk.state.getLaunchWalletV2Bulk(
      validated.feeClaimers.map(({ provider, username }) => ({
        provider,
        username,
      })),
    );
    const resolvedByKey = new Map(
      resolved.map((wallet) => [
        `${wallet.provider}:${wallet.username}`.toLowerCase(),
        wallet,
      ]),
    );

    const claimerBpsByWallet = new Map<string, number>();
    for (const claimer of validated.feeClaimers) {
      const resolvedWallet = resolvedByKey.get(
        `${claimer.provider}:${claimer.username}`.toLowerCase(),
      );
      if (!resolvedWallet?.wallet) {
        throw new Error(
          `Bags wallet not found for ${claimer.provider}:${claimer.username}`,
        );
      }
      addFeeClaimer(
        claimerBpsByWallet,
        publicKeyToString(resolvedWallet.wallet),
        claimer.bps,
      );
    }

    const platformFeeWallet = env.SOLANA_TREASURY_ADDRESS ?? validated.payer;
    addFeeClaimer(claimerBpsByWallet, platformFeeWallet, validated.shareFee);

    const feeClaimers = Array.from(claimerBpsByWallet, ([wallet, bps]) => ({
      user: new PublicKey(wallet),
      userBps: bps,
    }));
    const totalBps = feeClaimers.reduce(
      (sum, claimer) => sum + claimer.userBps,
      0,
    );
    if (totalBps !== 10_000) {
      throw new Error(
        `Bags fee claimers must total 10000 bps; got ${totalBps}.`,
      );
    }

    const payer = new PublicKey(validated.payer);
    const result = await sdk.config.createBagsFeeShareConfig({
      payer,
      baseMint: new PublicKey(validated.baseMint),
      feeClaimers,
      partner: validated.partner
        ? new PublicKey(validated.partner)
        : env.BAGS_PARTNER_WALLET
          ? new PublicKey(env.BAGS_PARTNER_WALLET)
          : undefined,
      partnerConfig: validated.partnerConfig
        ? new PublicKey(validated.partnerConfig)
        : env.BAGS_PARTNER_CONFIG_KEY
          ? new PublicKey(env.BAGS_PARTNER_CONFIG_KEY)
          : undefined,
      bagsConfigType: validated.bagsConfigType ?? env.BAGS_CONFIG_TYPE,
    });

    const signer = payoutSigner();
    if (!signer.publicKey.equals(payer)) {
      throw new Error(
        "SOLANA_PAYOUT_KEYPAIR must match the fee-share payer wallet.",
      );
    }

    const txSignatures: string[] = [];
    for (const bundle of result.bundles ?? []) {
      for (const tx of bundle) {
        txSignatures.push(
          await sdkModule.signAndSendTransaction(
            sdk.state.getConnection(),
            "processed",
            tx,
            signer,
          ),
        );
      }
    }
    for (const tx of result.transactions ?? []) {
      txSignatures.push(
        await sdkModule.signAndSendTransaction(
          sdk.state.getConnection(),
          "processed",
          tx,
          signer,
        ),
      );
    }

    return FeeShareConfigResponseSchema.parse({
      configKey: publicKeyToString(result.meteoraConfigKey),
      txSignatures,
      feeClaimersTotalBps: totalBps,
      partnerConfigKey: validated.partnerConfig ?? env.BAGS_PARTNER_CONFIG_KEY,
    });
  },

  /**
   * Resolve `provider` + `username` to a Bags-routed wallet address.
   * Used at launch (to know the platform-pool address) and during onboarding
   * (to validate that a fee claimer can be configured for a contributor).
   */
  async resolveWallet(
    provider: BagsProvider,
    username: string,
  ): Promise<ResolvedWallet> {
    if (!hasCredentials.bags()) {
      return ResolvedWalletSchema.parse(
        stubBags.resolvedWallet(provider, username),
      );
    }
    const raw = await bagsRest<{ success: boolean; response: ResolvedWallet }>(
      "token-launch/fee-share/wallet/v2",
      { query: { provider, username } },
    );
    return ResolvedWalletSchema.parse(raw.response);
  },

  /** Read claimable lamports per token-mint position for a given wallet. */
  async getClaimablePositions(
    walletAddress: string,
  ): Promise<ClaimablePositionsResponse> {
    if (!hasCredentials.bags()) {
      return ClaimablePositionsResponseSchema.parse(
        stubBags.claimablePositions(
          "StubMint11111111111111111111111111111111111",
        ),
      );
    }
    const [{ PublicKey }, sdk] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
    ]);
    const positions = await sdk.fee.getAllClaimablePositions(
      new PublicKey(walletAddress),
    );
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
