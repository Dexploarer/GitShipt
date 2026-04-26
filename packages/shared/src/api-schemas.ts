import { z } from "zod";

export const ApiErrorResponseSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  details: z.unknown().optional(),
  issues: z.unknown().optional(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const WalletNonceRequestSchema = z.object({
  address: z.string().min(32).max(44),
});
export type WalletNonceRequest = z.infer<typeof WalletNonceRequestSchema>;

export const WalletNonceResponseSchema = z.object({
  nonce: z.string().min(1),
  ttlSeconds: z.number().int().positive(),
});
export type WalletNonceResponse = z.infer<typeof WalletNonceResponseSchema>;

export const WalletVerifyResponseSchema = z.object({
  ok: z.literal(true),
  address: z.string().min(32).max(44),
});
export type WalletVerifyResponse = z.infer<typeof WalletVerifyResponseSchema>;

export const ClaimEscrowRequestSchema = z.object({
  projectId: z.string().min(1).optional(),
});
export type ClaimEscrowRequest = z.infer<typeof ClaimEscrowRequestSchema>;

export const MfaEnrollResponseSchema = z.object({
  qrDataUrl: z.string().min(1),
  secretBase32: z.string().min(1),
});
export type MfaEnrollResponse = z.infer<typeof MfaEnrollResponseSchema>;

export const MfaVerifyResponseSchema = z.object({
  ok: z.literal(true),
  confirmedAt: z.string().min(1),
});
export type MfaVerifyResponse = z.infer<typeof MfaVerifyResponseSchema>;
