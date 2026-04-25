import { NextResponse } from "next/server";
import { z } from "zod";
import { issueNonce } from "@/lib/auth/siws";
import { check } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  address: z.string().min(32).max(44),
});

/**
 * Issue a single-use, 5-minute SIWS nonce for the given Solana address.
 * Rate-limited to 10/min/IP to prevent nonce-flooding.
 */
export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await check("siws-verify", `nonce:${ip}`);
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const nonce = await issueNonce(parsed.data.address);
  return NextResponse.json({ nonce, ttlSeconds: 5 * 60 });
}
