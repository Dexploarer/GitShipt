import { z } from "zod";

/**
 * POST /api/claims/link request body. Wallet ownership is enforced server-side
 * by reading the better-auth session and looking up wallets table — the
 * client may supply `walletAddress` and we verify membership separately.
 */
export const ClaimLinkRequestSchema = z.object({
  contributorId: z.string().min(1),
  walletAddress: z.string().min(32).max(64),
});
export type ClaimLinkRequest = z.infer<typeof ClaimLinkRequestSchema>;

export const ClaimLinkResponseSchema = z.object({
  ok: z.literal(true),
  runId: z.string().min(1),
});
export type ClaimLinkResponse = z.infer<typeof ClaimLinkResponseSchema>;

/** Workflow-input shape for `processClaim`. JSON-serializable. */
export const ProcessClaimInputSchema = z.object({
  contributorId: z.string().min(1),
  userId: z.string().min(1),
  walletAddress: z.string().min(32).max(64),
});
export type ProcessClaimInput = z.infer<typeof ProcessClaimInputSchema>;
