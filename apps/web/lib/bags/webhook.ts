import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { serverEnv } from "@/lib/env";

const BagsWebhookPayloadSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    eventId: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(),
    event: z.string().optional(),
    tokenMint: z.string().min(32).optional(),
    baseMint: z.string().min(32).optional(),
    mint: z.string().min(32).optional(),
    signature: z.string().optional(),
    txSignature: z.string().optional(),
    transactionSignature: z.string().optional(),
  })
  .passthrough();

export type BagsWebhookPayload = z.infer<typeof BagsWebhookPayloadSchema>;

type VerifyResult =
  | {
      ok: true;
      event: string;
      delivery: string;
      signature: string | null;
      payload: BagsWebhookPayload;
    }
  | {
      ok: false;
      reason:
        | "no_secret"
        | "missing_signature"
        | "bad_signature"
        | "invalid_json"
        | "invalid_payload";
    };

/**
 * Bags does not publish webhook header names in the local skill docs, so this
 * verifier accepts the common signed-body variants while keeping one hard rule:
 * the raw request body must match BAGS_WEBHOOK_SECRET with HMAC-SHA256.
 */
export async function verifyAndParseBagsWebhook(
  req: Request,
): Promise<VerifyResult> {
  const secret = serverEnv().BAGS_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "no_secret" };

  const raw = await req.text();
  const signature = readSignature(req.headers);
  if (!signature) return { ok: false, reason: "missing_signature" };

  if (!verifyHmac(raw, secret, signature)) {
    return { ok: false, reason: "bad_signature" };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const parsed = BagsWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "invalid_payload" };

  const payload = parsed.data;
  const event =
    req.headers.get("x-bags-event") ??
    req.headers.get("x-webhook-event") ??
    req.headers.get("x-event-type") ??
    payload.type ??
    payload.event ??
    "bags.event";

  const delivery =
    req.headers.get("x-bags-delivery") ??
    req.headers.get("x-bags-event-id") ??
    req.headers.get("x-webhook-id") ??
    req.headers.get("x-request-id") ??
    stringish(payload.eventId) ??
    stringish(payload.id) ??
    createHash("sha256").update(raw).digest("hex");

  return {
    ok: true,
    event,
    delivery,
    signature,
    payload,
  };
}

export function extractTokenMint(payload: BagsWebhookPayload): string | null {
  return payload.tokenMint ?? payload.baseMint ?? payload.mint ?? null;
}

export function extractTransactionSignature(
  payload: BagsWebhookPayload,
): string | null {
  return (
    payload.transactionSignature ??
    payload.txSignature ??
    payload.signature ??
    null
  );
}

function readSignature(headers: Headers): string | null {
  return (
    headers.get("x-bags-signature") ??
    headers.get("x-webhook-signature") ??
    headers.get("x-signature") ??
    headers.get("x-hub-signature-256") ??
    headers.get("signature")
  );
}

function verifyHmac(raw: string, secret: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(raw).digest();
  const candidates = signature
    .split(",")
    .map((part) => part.trim())
    .flatMap((part) => {
      const normalized = part.startsWith("sha256=")
        ? part.slice("sha256=".length)
        : part.startsWith("v1=")
          ? part.slice("v1=".length)
          : part;
      return [decodeHex(normalized), decodeBase64(normalized)].filter(
        (buf): buf is Buffer => Boolean(buf),
      );
    });

  return candidates.some(
    (candidate) =>
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected),
  );
}

function decodeHex(value: string): Buffer | null {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) return null;
  return Buffer.from(value, "hex");
}

function decodeBase64(value: string): Buffer | null {
  try {
    return Buffer.from(value, "base64");
  } catch {
    return null;
  }
}

function stringish(value: string | number | undefined): string | null {
  if (value === undefined || value === "") return null;
  return String(value);
}
