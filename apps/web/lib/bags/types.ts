import { z } from "zod";

/** Bags fee-claimer social providers for identity-based wallet resolution. */
export const BagsProviderSchema = z.enum([
  "moltbook",
  "github",
  "twitter",
  "kick",
  "tiktok",
]);
export type BagsProvider = z.infer<typeof BagsProviderSchema>;

export const SolanaAddressSchema = z.string().min(32).max(64);

export const SocialFeeClaimerSchema = z.object({
  provider: BagsProviderSchema,
  username: z.string().min(1),
  bps: z.number().int().min(0).max(10_000),
});

export const WalletFeeClaimerSchema = z.object({
  wallet: SolanaAddressSchema,
  bps: z.number().int().min(0).max(10_000),
});

export const FeeClaimerSchema = z.union([
  SocialFeeClaimerSchema,
  WalletFeeClaimerSchema,
]);
export type FeeClaimer = z.infer<typeof FeeClaimerSchema>;

export const TokenInfoInputSchema = z.object({
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url(),
  website: z.string().url().optional(),
  twitter: z.string().min(1).max(100).optional(),
  telegram: z.string().min(1).max(100).optional(),
});
export type TokenInfoInput = z.infer<typeof TokenInfoInputSchema>;

export const TokenInfoResponseSchema = z.object({
  tokenMint: z.string().min(32),
  tokenMetadata: z.string().url(),
  __stub: z.boolean().optional(),
});
export type TokenInfoResponse = z.infer<typeof TokenInfoResponseSchema>;

export const FeeShareConfigInputSchema = z.object({
  payer: z.string().min(32),
  baseMint: z.string().min(32),
  feeClaimers: z.array(FeeClaimerSchema).min(1).max(100),
  /**
   * GitBags platform fee taken from the fee-claimer rail. The wrapper appends
   * this to SOLANA_TREASURY_ADDRESS (or payer as a local fallback) before
   * creating the Bags config. Bags partner revenue is configured separately
   * with BAGS_PARTNER_WALLET + BAGS_PARTNER_CONFIG_KEY.
   */
  shareFee: z.number().int().min(0).max(2000),
  platformFeeWallet: z.string().min(32).optional(),
  partner: z.string().min(32).optional(),
  partnerConfig: z.string().min(32).optional(),
  bagsConfigType: z.string().min(1).optional(),
});
export type FeeShareConfigInput = z.infer<typeof FeeShareConfigInputSchema>;

export const FeeShareConfigResponseSchema = z.object({
  configKey: z.string().min(32),
  txSignatures: z.array(z.string()).default([]),
  feeClaimersTotalBps: z.number().int().min(0).max(10_000).optional(),
  partnerWallet: SolanaAddressSchema.optional(),
  partnerConfigKey: z.string().min(32).optional(),
  poolClaimerWallet: SolanaAddressSchema.optional(),
  __stub: z.boolean().optional(),
});
export type FeeShareConfigResponse = z.infer<
  typeof FeeShareConfigResponseSchema
>;

export const ResolvedWalletSchema = z.object({
  provider: BagsProviderSchema,
  platformData: z.object({
    id: z.string(),
    username: z.string(),
    display_name: z.string().nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
  }),
  wallet: z.string().min(32),
  __stub: z.boolean().optional(),
});
export type ResolvedWallet = z.infer<typeof ResolvedWalletSchema>;

export const ClaimablePositionSchema = z.object({
  baseMint: z.string().min(32),
  totalClaimableLamportsUserShare: z.coerce.bigint(),
  virtualPoolClaimableLamportsUserShare: z.coerce.bigint().optional(),
  dammPoolClaimableLamportsUserShare: z.coerce.bigint().optional(),
  isMigrated: z.boolean().optional(),
});
export type ClaimablePosition = z.infer<typeof ClaimablePositionSchema>;

export const ClaimablePositionsResponseSchema = z.object({
  positions: z.array(ClaimablePositionSchema),
  __stub: z.boolean().optional(),
});
export type ClaimablePositionsResponse = z.infer<
  typeof ClaimablePositionsResponseSchema
>;

export const LifetimeFeesSchema = z.object({
  tokenMint: z.string().min(32),
  totalLifetimeLamports: z.coerce.bigint(),
  totalLifetimeUsd: z.number().nullable().optional(),
  __stub: z.boolean().optional(),
});
export type LifetimeFees = z.infer<typeof LifetimeFeesSchema>;

export const LaunchIntentInputSchema = z.object({
  name: z.string().min(1).max(32).optional(),
  symbol: z.string().min(1).max(10).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  twitter: z.string().min(1).max(100).optional(),
  telegram: z.string().min(1).max(100).optional(),
  feeShareBps: z.number().int().min(0).max(10_000).optional(),
  adminWallet: z.string().min(32).optional(),
  partner: z.string().min(32).optional(),
  partnerConfig: z.string().min(32).optional(),
  refCode: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  tokenizeEquity: z.boolean().optional(),
});
export type LaunchIntentInput = z.infer<typeof LaunchIntentInputSchema>;

export const TokenCreatorSchema = z
  .object({
    wallet: z.string().min(32),
    isCreator: z.boolean().optional(),
    provider: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    providerUsername: z.string().nullable().optional(),
    pfp: z.string().url().nullable().optional(),
    royaltyBps: z.number().int().min(0).max(10_000).optional(),
  })
  .passthrough();
export type TokenCreator = z.infer<typeof TokenCreatorSchema>;

export const TokenClaimEventSchema = z
  .object({
    signature: z.string().optional(),
    tokenMint: z.string().min(32).optional(),
    claimer: z.string().min(32).optional(),
    wallet: z.string().min(32).optional(),
    amountLamports: z.coerce.bigint().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();
export type TokenClaimEvent = z.infer<typeof TokenClaimEventSchema>;

export const IncorporationCategorySchema = z.enum([
  "RWA",
  "AI",
  "DEFI",
  "INFRA",
  "DEPIN",
  "LEGAL",
  "GAMING",
  "NFT",
  "MEME",
]);
export type IncorporationCategory = z.infer<typeof IncorporationCategorySchema>;

const IsoAlpha3CountrySchema = z.string().regex(/^[A-Z]{3}$/);

export const IncorporationFounderInputSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  nationalityCountry: IsoAlpha3CountrySchema,
  taxResidencyCountry: IsoAlpha3CountrySchema,
  residentialAddress: z.string().min(1).max(500),
  shareBasisPoint: z.number().int().min(0).max(10_000),
});
export type IncorporationFounderInput = z.infer<
  typeof IncorporationFounderInputSchema
>;

export const IncorporationInputSchema = z
  .object({
    orderUUID: z.string().min(1),
    paymentSignature: z.string().min(32),
    projectName: z.string().min(1).max(200),
    tokenAddress: z.string().min(32),
    founders: z.array(IncorporationFounderInputSchema).min(1).max(10),
    incorporationShareBasisPoint: z.number().int().min(2000).max(3000),
    preferredCompanyNames: z.tuple([
      z.string().min(1).max(200),
      z.string().min(1).max(200),
      z.string().min(1).max(200),
    ]),
    category: IncorporationCategorySchema.optional(),
    twitterHandle: z
      .string()
      .regex(/^[A-Za-z0-9_]{1,50}$/)
      .optional(),
  })
  .refine(
    (value) =>
      value.founders.reduce(
        (sum, founder) => sum + founder.shareBasisPoint,
        0,
      ) +
        value.incorporationShareBasisPoint ===
      10_000,
    "Founder shares plus incorporation share must total 10000 bps.",
  );
export type IncorporationInput = z.infer<typeof IncorporationInputSchema>;

export const IncorporationPaymentSchema = z.object({
  orderUUID: z.string().min(1),
  recipientWallet: z.string().min(32),
  priceUSDC: z.string().min(1),
  transaction: z.unknown(),
  lastValidBlockHeight: z.number().int().positive(),
});
export type IncorporationPayment = z.infer<typeof IncorporationPaymentSchema>;

const IncorporationFounderResponseSchema = z
  .object({
    founderId: z.string().optional(),
    id: z.string().optional(),
    firstName: z.string(),
    lastName: z.string(),
    kycUrl: z.string().url().nullable().optional(),
    kycStatus: z.string().optional(),
    formUrl: z.string().url().nullable().optional(),
    pepCompleted: z.boolean().optional(),
    ipAttributionAcknowledged: z.boolean().optional(),
    ipAttributionAcknowledgedAt: z.string().nullable().optional(),
    shareBasisPoint: z.number().int(),
  })
  .passthrough();

export const IncorporationProjectSchema = z
  .object({
    tokenAddress: z.string().min(32),
    incorporationStatus: z.string(),
    founders: z.array(IncorporationFounderResponseSchema).default([]),
    incorporationShareBasisPoint: z.number().int(),
    category: z.string().nullable().optional(),
    twitterHandle: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    preferredCompanyNames: z.array(z.string()).default([]),
    isReadyForIncorporation: z.boolean().optional(),
    incorporationStarted: z.boolean().optional(),
  })
  .passthrough();
export type IncorporationProject = z.infer<typeof IncorporationProjectSchema>;

export const StartIncorporationResponseSchema = z.object({
  tokenAddress: z.string().min(32),
  incorporationStarted: z.boolean(),
});
export type StartIncorporationResponse = z.infer<
  typeof StartIncorporationResponseSchema
>;

export const SubmitTransactionResponseSchema = z.union([
  z.string().min(32),
  z.object({
    success: z.boolean().optional(),
    response: z.string().min(32),
  }),
]);

export const LaunchTransactionInputSchema = z.object({
  tokenMint: SolanaAddressSchema,
  metadataUrl: z.string().min(1),
  configKey: SolanaAddressSchema,
  launchWallet: SolanaAddressSchema,
  initialBuyLamports: z.number().int().min(0).default(0),
});

export const LaunchTransactionResultSchema = z.object({
  signature: z.string().min(32),
});
export type LaunchTransactionResult = z.infer<
  typeof LaunchTransactionResultSchema
>;
