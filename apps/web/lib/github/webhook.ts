import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";

export type VerifyOk = {
  ok: true;
  event: string;
  delivery: string;
  payload: unknown;
};

export type VerifyErr = { ok: false; reason: string };

const encoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexEqual(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  // Buffer.from rejects malformed hex by silently dropping odd nibbles.
  // We've already length-checked above; the explicit length match below
  // catches mismatched buffers from malformed hex.
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return nodeTimingSafeEqual(a, b);
}

/**
 * Verifies a GitHub webhook HMAC signature and parses the JSON body.
 * Returns the parsed payload plus event/delivery metadata.
 *
 * Caller responsibilities:
 *  - 401 on `{ ok: false }`
 *  - 503 specifically on `reason === 'no_secret'`
 */
export async function verifyAndParse(
  req: Request,
): Promise<VerifyOk | VerifyErr> {
  const env = serverEnv();
  const secret = env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "no_secret" };

  const event = req.headers.get("x-github-event");
  const delivery = req.headers.get("x-github-delivery");
  const sigHeader = req.headers.get("x-hub-signature-256");
  if (!event) return { ok: false, reason: "missing_event" };
  if (!delivery) return { ok: false, reason: "missing_delivery" };
  if (!sigHeader || !sigHeader.startsWith("sha256=")) {
    return { ok: false, reason: "missing_signature" };
  }

  const raw = await req.text();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const macBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(raw),
  );
  const expectedHex = bytesToHex(macBuffer);
  const providedHex = sigHeader.slice("sha256=".length);

  if (!hexEqual(providedHex, expectedHex)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "bad_json" };
  }

  return { ok: true, event, delivery, payload };
}
