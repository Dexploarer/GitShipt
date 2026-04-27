import "server-only";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { hasCredentials } from "@/lib/env";
import { bags } from "@/lib/bags/client";
import { normalizeBagsTransaction } from "@/lib/bags/transactions";

export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

const SolanaAddressSchema = z.string().min(32).max(64);
const NumericStringSchema = z.string().regex(/^\d+$/);

const TradeQuotePlatformFeeSchema = z
  .object({
    amount: NumericStringSchema,
    feeAccount: SolanaAddressSchema,
    feeBps: z.number().int().min(0).max(10_000),
    segmenterFeeAmount: NumericStringSchema,
    segmenterFeePct: z.number().min(0),
  })
  .passthrough();

const TradeQuoteRoutePlanLegSchema = z
  .object({
    data: z.string().optional(),
    inAmount: NumericStringSchema,
    inputMint: SolanaAddressSchema,
    inputMintDecimals: z.number().int().min(0).max(18).optional(),
    marketKey: z.string().min(1).optional(),
    outAmount: NumericStringSchema,
    outputMint: SolanaAddressSchema,
    outputMintDecimals: z.number().int().min(0).max(18).optional(),
    venue: z.string().min(1),
  })
  .passthrough();

export const TradeQuoteResponseSchema = z
  .object({
    contextSlot: z.number().int().nonnegative(),
    inAmount: NumericStringSchema,
    inputMint: SolanaAddressSchema,
    minOutAmount: NumericStringSchema,
    otherAmountThreshold: NumericStringSchema,
    outAmount: NumericStringSchema,
    outputMint: SolanaAddressSchema,
    priceImpactPct: z.string().min(1),
    routePlan: z.array(TradeQuoteRoutePlanLegSchema),
    slippageBps: z.number().int().min(0).max(10_000),
    outTransferFee: NumericStringSchema.optional(),
    platformFee: TradeQuotePlatformFeeSchema.optional(),
    requestId: z.string().min(1),
    simulatedComputeUnits: z.number().int().nonnegative().nullable(),
  })
  .passthrough();
export type TradeQuoteResponse = z.infer<typeof TradeQuoteResponseSchema>;

export const ProjectTradeQuoteRequestSchema = z.object({
  side: z.enum(["buy", "sell"]).default("buy"),
  amount: z.number().int().positive().max(1_000_000_000_000),
  slippageBps: z.number().int().min(1).max(1_000).default(100),
});
export type ProjectTradeQuoteRequest = z.infer<
  typeof ProjectTradeQuoteRequestSchema
>;

export const ProjectTradeQuoteResponseSchema = z.object({
  tokenMint: SolanaAddressSchema,
  side: z.enum(["buy", "sell"]),
  quote: TradeQuoteResponseSchema,
  inputDecimals: z.number().int().min(0).max(18),
  outputDecimals: z.number().int().min(0).max(18),
});
export type ProjectTradeQuoteResponse = z.infer<
  typeof ProjectTradeQuoteResponseSchema
>;

export const ProjectTradeSwapRequestSchema = z.object({
  quoteResponse: TradeQuoteResponseSchema,
  userPublicKey: SolanaAddressSchema,
});
export type ProjectTradeSwapRequest = z.infer<
  typeof ProjectTradeSwapRequestSchema
>;

export const ProjectTradeSwapResponseSchema = z.object({
  transactionBase64: z.string().min(1),
  computeUnitLimit: z.number().int().nonnegative(),
  lastValidBlockHeight: z.number().int().positive(),
  prioritizationFeeLamports: z.number().int().nonnegative(),
});
export type ProjectTradeSwapResponse = z.infer<
  typeof ProjectTradeSwapResponseSchema
>;

export function tradingCredentialsReady():
  | { ok: true }
  | { ok: false; code: string; message: string } {
  if (!hasCredentials.bags()) {
    return {
      ok: false,
      code: "bags_unavailable",
      message: "Bags API key not configured.",
    };
  }
  return { ok: true };
}

export async function getProjectTradeQuote(args: {
  tokenMint: string;
  side: "buy" | "sell";
  amount: number;
  slippageBps: number;
}): Promise<ProjectTradeQuoteResponse> {
  const inputMint = args.side === "buy" ? WRAPPED_SOL_MINT : args.tokenMint;
  const outputMint = args.side === "buy" ? args.tokenMint : WRAPPED_SOL_MINT;
  const quote = TradeQuoteResponseSchema.parse(
    await bags.getTradeQuote({
      inputMint,
      outputMint,
      amount: args.amount,
      slippageMode: "auto",
      slippageBps: args.slippageBps,
    }),
  );
  const firstLeg = quote.routePlan[0];
  const lastLeg = quote.routePlan.at(-1);

  return ProjectTradeQuoteResponseSchema.parse({
    tokenMint: args.tokenMint,
    side: args.side,
    quote,
    inputDecimals:
      firstLeg?.inputMint === inputMint ? firstLeg.inputMintDecimals : 9,
    outputDecimals:
      lastLeg?.outputMint === outputMint ? lastLeg.outputMintDecimals : 9,
  });
}

export async function createProjectSwapTransaction(args: {
  quoteResponse: TradeQuoteResponse;
  userPublicKey: string;
}): Promise<ProjectTradeSwapResponse> {
  const result = await bags.createSwapTransaction({
    quoteResponse: args.quoteResponse,
    userPublicKey: args.userPublicKey,
  });
  const normalized = await normalizeBagsTransaction(result.transaction);
  const transactionBase64 = Buffer.from(
    await serializeUnsignedTransaction(normalized),
  ).toString("base64");

  return ProjectTradeSwapResponseSchema.parse({
    transactionBase64,
    computeUnitLimit: result.computeUnitLimit,
    lastValidBlockHeight: result.lastValidBlockHeight,
    prioritizationFeeLamports: result.prioritizationFeeLamports,
  });
}

async function serializeUnsignedTransaction(
  transaction: Awaited<ReturnType<typeof normalizeBagsTransaction>>,
): Promise<Uint8Array> {
  const { Transaction, VersionedTransaction } = await import("@solana/web3.js");
  if (transaction instanceof VersionedTransaction) {
    return transaction.serialize();
  }
  if (transaction instanceof Transaction) {
    return transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
  }
  throw new Error("Bags returned an unsupported swap transaction.");
}
