import { z } from "zod";

/** Bags fee-claimer provider. Plain wallet addresses are NOT valid. */
export const BagsProviderSchema = z.enum(["github", "twitter", "kick", "tiktok"]);
export type BagsProvider = z.infer<typeof BagsProviderSchema>;

export const FeeClaimerSchema = z.object({
  provider: BagsProviderSchema,
  username: z.string().min(1),
  bps: z.number().int().min(0).max(10_000),
});
export type FeeClaimer = z.infer<typeof FeeClaimerSchema>;

export const TokenInfoInputSchema = z.object({
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url(),
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
  shareFee: z.number().int().min(0).max(2000),
});
export type FeeShareConfigInput = z.infer<typeof FeeShareConfigInputSchema>;

export const FeeShareConfigResponseSchema = z.object({
  configKey: z.string().min(32),
  __stub: z.boolean().optional(),
});
export type FeeShareConfigResponse = z.infer<typeof FeeShareConfigResponseSchema>;

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
export type ClaimablePositionsResponse = z.infer<typeof ClaimablePositionsResponseSchema>;

export const LifetimeFeesSchema = z.object({
  tokenMint: z.string().min(32),
  totalLifetimeLamports: z.coerce.bigint(),
  totalLifetimeUsd: z.number().nullable().optional(),
  __stub: z.boolean().optional(),
});
export type LifetimeFees = z.infer<typeof LifetimeFeesSchema>;
