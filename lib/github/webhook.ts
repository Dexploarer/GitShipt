import { serverEnv } from "@/lib/env";

export type VerifyOk = {
  ok: true;
  event: string;
  delivery: string;
  payload: unknown;
};

export type VerifyErr = { ok: false; reason: string };

const encoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    // Use non-null assertion: bounds checked above.
    diff |= (a[i] as number) ^ (b[i] as number);
  }
  return diff === 0;
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

  if (
    providedHex.length !== expectedHex.length ||
    !timingSafeEqual(hexToBytes(providedHex), hexToBytes(expectedHex))
  ) {
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
