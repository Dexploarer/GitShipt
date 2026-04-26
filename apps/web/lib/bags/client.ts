import { serverEnv, hasCredentials, canLaunchOnBags } from "@/lib/env";
import { payoutSigner } from "@/lib/solana/signer";
import bs58 from "bs58";
import {
  TokenInfoInputSchema,
  TokenInfoResponseSchema,
  FeeShareConfigInputSchema,
  FeeShareConfigResponseSchema,
  ResolvedWalletSchema,
  ClaimablePositionsResponseSchema,
  LifetimeFeesSchema,
  LaunchIntentInputSchema,
  TokenCreatorSchema,
  TokenClaimEventSchema,
  IncorporationInputSchema,
  IncorporationPaymentSchema,
  IncorporationProjectSchema,
  StartIncorporationResponseSchema,
  SubmitTransactionResponseSchema,
  LaunchTransactionInputSchema,
  LaunchTransactionResultSchema,
  type TokenInfoInput,
  type TokenInfoResponse,
  type FeeShareConfigInput,
  type FeeShareConfigResponse,
  type ResolvedWallet,
  type ClaimablePositionsResponse,
  type LifetimeFees,
  type LaunchIntentInput,
  type TokenCreator,
  type TokenClaimEvent,
  type IncorporationInput,
  type IncorporationPayment,
  type IncorporationProject,
  type StartIncorporationResponse,
  type BagsProvider,
  type FeeClaimer,
  type LaunchTransactionResult,
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
      website?: string;
      twitter?: string;
      telegram?: string;
    }) => Promise<{
      tokenMint: string;
      tokenMetadata: string;
    }>;
    createLaunchTransaction: (input: {
      metadataUrl: string;
      tokenMint: unknown;
      launchWallet: unknown;
      initialBuyLamports: number;
      configKey: unknown;
    }) => Promise<unknown>;
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
    getTokenCreators: (tokenMint: unknown) => Promise<unknown[]>;
    getTokenClaimEvents: (
      tokenMint: unknown,
      options?: { limit?: number; offset?: number },
    ) => Promise<unknown[]>;
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
  incorporation: {
    startPayment: (input: {
      payerWallet: unknown;
      payWithSol?: boolean;
    }) => Promise<unknown>;
    incorporate: (input: {
      orderUUID: string;
      paymentSignature: string;
      projectName: string;
      tokenAddress: unknown;
      founders: Array<{
        firstName: string;
        lastName: string;
        email: string;
        nationalityCountry: string;
        taxResidencyCountry: string;
        residentialAddress: string;
        shareBasisPoint: number;
      }>;
      incorporationShareBasisPoint: number;
      preferredCompanyNames: string[];
      category?: string;
      twitterHandle?: string;
    }) => Promise<unknown>;
    getDetails: (input: { tokenAddress: unknown }) => Promise<unknown>;
    list: () => Promise<unknown[]>;
    startIncorporation: (input: { tokenAddress: unknown }) => Promise<unknown>;
  };
};

type BagsSdkModule = {
  BagsSDK: new (
    apiKey: string,
    connection: unknown,
    commitment: "processed",
  ) => BagsSdk;
};

let _sdk: BagsSdk | null = null;
let _sdkModule: BagsSdkModule | null = null;

const DEMO_TOKEN_MINT = "GBAGSdemoTokenMint11111111111111111111111111";
const STUB_TOKEN_SUFFIX = "ags1111111111111111111111111111111111111";

function isPlaceholderTokenMint(tokenMint: string): boolean {
  return tokenMint === DEMO_TOKEN_MINT || tokenMint.endsWith(STUB_TOKEN_SUFFIX);
}

function bagsFmUrl(path = ""): string {
  return new URL(path, "https://bags.fm/").toString();
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

function normalizePublicKeyFields(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    out[key] =
      field &&
      typeof field === "object" &&
      "toBase58" in field &&
      typeof field.toBase58 === "function"
        ? field.toBase58()
        : field;
  }
  return out;
}

function addFeeClaimer(
  claimers: Map<string, number>,
  wallet: string,
  bps: number,
): void {
  if (bps <= 0) return;
  claimers.set(wallet, (claimers.get(wallet) ?? 0) + bps);
}

function isSocialClaimer(
  claimer: FeeClaimer,
): claimer is Extract<FeeClaimer, { provider: BagsProvider }> {
  return "provider" in claimer;
}

function extractSubmittedSignature(raw: unknown): string {
  const parsed = SubmitTransactionResponseSchema.parse(raw);
  return typeof parsed === "string" ? parsed : parsed.response;
}

async function signAndSubmitViaBags(transaction: unknown): Promise<string> {
  const { Transaction, VersionedTransaction } = await import("@solana/web3.js");
  const signer = payoutSigner();

  let serialized: Uint8Array | Buffer;
  if (transaction instanceof VersionedTransaction) {
    transaction.sign([signer]);
    serialized = transaction.serialize();
  } else if (transaction instanceof Transaction) {
    transaction.sign(signer);
    serialized = transaction.serialize();
  } else {
    throw new Error("Bags returned an unsupported transaction type.");
  }

  const raw = await bagsRest<unknown>("solana/send-transaction", {
    method: "POST",
    body: JSON.stringify({ transaction: bs58.encode(serialized) }),
  });
  return extractSubmittedSignature(raw);
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
    const [{ PublicKey }, sdk] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
    ]);

    const socialClaimers = validated.feeClaimers.filter(isSocialClaimer);
    const resolved =
      socialClaimers.length > 0
        ? await sdk.state.getLaunchWalletV2Bulk(
            socialClaimers.map(({ provider, username }) => ({
              provider,
              username,
            })),
          )
        : [];
    const resolvedByKey = new Map(
      resolved.map((wallet) => [
        `${wallet.provider}:${wallet.username}`.toLowerCase(),
        wallet,
      ]),
    );

    const claimerBpsByWallet = new Map<string, number>();
    for (const claimer of validated.feeClaimers) {
      if (!isSocialClaimer(claimer)) {
        addFeeClaimer(claimerBpsByWallet, claimer.wallet, claimer.bps);
        continue;
      }
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

    const platformFeeWallet =
      validated.platformFeeWallet ??
      env.SOLANA_TREASURY_ADDRESS ??
      validated.payer;
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
        txSignatures.push(await signAndSubmitViaBags(tx));
      }
    }
    for (const tx of result.transactions ?? []) {
      txSignatures.push(await signAndSubmitViaBags(tx));
    }

    return FeeShareConfigResponseSchema.parse({
      configKey: publicKeyToString(result.meteoraConfigKey),
      txSignatures,
      feeClaimersTotalBps: totalBps,
      partnerConfigKey: validated.partnerConfig ?? env.BAGS_PARTNER_CONFIG_KEY,
      poolClaimerWallet:
        validated.feeClaimers.length === 1
          ? Array.from(claimerBpsByWallet.keys())[0]
          : undefined,
    });
  },

  async createAndSubmitLaunchTransaction(args: {
    tokenMint: string;
    metadataUrl: string;
    configKey: string;
    launchWallet: string;
    initialBuyLamports?: number;
  }): Promise<LaunchTransactionResult> {
    const validated = LaunchTransactionInputSchema.parse(args);
    const [{ PublicKey }, sdk] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
    ]);
    const tx = await sdk.tokenLaunch.createLaunchTransaction({
      metadataUrl: validated.metadataUrl,
      tokenMint: new PublicKey(validated.tokenMint),
      configKey: new PublicKey(validated.configKey),
      launchWallet: new PublicKey(validated.launchWallet),
      initialBuyLamports: validated.initialBuyLamports,
    });
    return LaunchTransactionResultSchema.parse({
      signature: await signAndSubmitViaBags(tx),
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

  async signAndSubmitTransaction(transaction: unknown): Promise<string> {
    return signAndSubmitViaBags(transaction);
  },

  /** Build a Bags-hosted launch intent URL for user-signed handoff flows. */
  createLaunchIntentUrl(input: LaunchIntentInput): string {
    const validated = LaunchIntentInputSchema.parse(input);
    const url = new URL("launch", "https://bags.fm/");
    url.searchParams.set("intent", "true");
    if (validated.name) url.searchParams.set("name", validated.name);
    if (validated.symbol) url.searchParams.set("ticker", validated.symbol);
    if (validated.description) {
      url.searchParams.set("description", validated.description);
    }
    if (validated.imageUrl) url.searchParams.set("image", validated.imageUrl);
    if (validated.website) url.searchParams.set("website", validated.website);
    if (validated.twitter) url.searchParams.set("twitter", validated.twitter);
    if (validated.telegram) {
      url.searchParams.set("telegram", validated.telegram);
    }
    if (validated.feeShareBps !== undefined) {
      url.searchParams.set("feeShareBps", String(validated.feeShareBps));
    }
    if (validated.adminWallet) {
      url.searchParams.set("adminWallet", validated.adminWallet);
    }
    if (validated.partner) url.searchParams.set("partner", validated.partner);
    if (validated.partnerConfig) {
      url.searchParams.set("partnerConfig", validated.partnerConfig);
    }
    if (validated.tokenizeEquity !== undefined) {
      url.searchParams.set(
        "tokenizeEquity",
        validated.tokenizeEquity ? "true" : "false",
      );
    }
    return url.toString();
  },

  bagsTokenUrl(tokenMint: string): string {
    return bagsFmUrl(tokenMint);
  },

  async getTokenCreators(tokenMint: string): Promise<TokenCreator[]> {
    if (!hasCredentials.bags() || isPlaceholderTokenMint(tokenMint)) return [];
    const [{ PublicKey }, sdk] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
    ]);
    const creators = await sdk.state.getTokenCreators(new PublicKey(tokenMint));
    return creators.map((creator) =>
      TokenCreatorSchema.parse(normalizePublicKeyFields(creator)),
    );
  },

  async getTokenClaimEvents(
    tokenMint: string,
    options?: { limit?: number; offset?: number },
  ): Promise<TokenClaimEvent[]> {
    if (!hasCredentials.bags() || isPlaceholderTokenMint(tokenMint)) return [];
    const [{ PublicKey }, sdk] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
    ]);
    const events = await sdk.state.getTokenClaimEvents(
      new PublicKey(tokenMint),
      options,
    );
    return events.map((event) =>
      TokenClaimEventSchema.parse(normalizePublicKeyFields(event)),
    );
  },

  async startIncorporationPayment(args: {
    payerWallet: string;
    payWithSol?: boolean;
  }): Promise<IncorporationPayment> {
    if (!hasCredentials.bags()) {
      throw new Error("BAGS_API_KEY is required for incorporation payments.");
    }
    const [{ PublicKey }, sdk] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
    ]);
    const raw = await sdk.incorporation.startPayment({
      payerWallet: new PublicKey(args.payerWallet),
      payWithSol: args.payWithSol,
    });
    return IncorporationPaymentSchema.parse(raw);
  },

  async submitIncorporation(
    input: IncorporationInput,
  ): Promise<IncorporationProject> {
    if (!hasCredentials.bags()) {
      throw new Error("BAGS_API_KEY is required for incorporation.");
    }
    const validated = IncorporationInputSchema.parse(input);
    const [{ PublicKey }, sdk] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
    ]);
    const raw = await sdk.incorporation.incorporate({
      ...validated,
      tokenAddress: new PublicKey(validated.tokenAddress),
    });
    return IncorporationProjectSchema.parse(raw);
  },

  async getIncorporationDetails(
    tokenAddress: string,
  ): Promise<IncorporationProject | null> {
    if (!hasCredentials.bags() || isPlaceholderTokenMint(tokenAddress)) {
      return null;
    }
    const [{ PublicKey }, sdk] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
    ]);
    const raw = await sdk.incorporation.getDetails({
      tokenAddress: new PublicKey(tokenAddress),
    });
    return IncorporationProjectSchema.parse(raw);
  },

  async listIncorporations(): Promise<IncorporationProject[]> {
    if (!hasCredentials.bags()) return [];
    const sdk = await getSdk();
    const raw = await sdk.incorporation.list();
    return raw.map((project) => IncorporationProjectSchema.parse(project));
  },

  async startIncorporation(
    tokenAddress: string,
  ): Promise<StartIncorporationResponse> {
    if (!hasCredentials.bags()) {
      throw new Error("BAGS_API_KEY is required for incorporation.");
    }
    const [{ PublicKey }, sdk] = await Promise.all([
      import("@solana/web3.js"),
      getSdk(),
    ]);
    const raw = await sdk.incorporation.startIncorporation({
      tokenAddress: new PublicKey(tokenAddress),
    });
    return StartIncorporationResponseSchema.parse(raw);
  },
};

export type BagsClient = typeof bags;
