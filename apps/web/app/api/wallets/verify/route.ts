import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySiws, SiwsMessageSchema } from "@/lib/auth/siws";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { wallets } from "@/db/schema";
import { check } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { hasCredentials, serverEnv, clientEnv } from "@/lib/env";
import { withIdempotency } from "@/lib/idempotency";
import { headers } from "next/headers";
import { WalletVerifyResponseSchema } from "@repo/shared";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  message: SiwsMessageSchema,
  signature: z.string().min(64),
});

/**
 * SIWS verify endpoint. Flow:
 *   1. Rate limit by IP.
 *   2. Read current better-auth session (must be signed in via GitHub first).
 *   3. Verify signature against the SIWS message.
 *   4. UPSERT wallet row keyed on (userId, address).
 *   5. Audit log entry.
 *
 * Returns 503 when DB is not configured (stub mode).
 */
export async function POST(req: Request): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "auth_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await check("siws-verify", `verify:${ip}`);
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Session check (auth must already exist via GitHub OAuth).
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const env = serverEnv();
  const expectedDomain = new URL(
    env.BETTER_AUTH_URL ?? clientEnv().NEXT_PUBLIC_APP_URL,
  ).host;
  const expectedChainId = `solana:${clientEnv().NEXT_PUBLIC_SOLANA_CLUSTER}`;

  const result = await verifySiws({
    message: parsed.data.message,
    signatureBase58: parsed.data.signature,
    expectedDomain,
    expectedChainId,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: "verify_failed", reason: result.reason },
      { status: 400 },
    );
  }

  const idempotencyKey = req.headers.get("idempotency-key");

  const persisted = await withIdempotency(
    idempotencyKey,
    async () => {
      await dbHttp
        .insert(wallets)
        .values({
          userId: session.user.id,
          address: result.address!,
          chain: "solana",
          verifiedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [wallets.userId, wallets.address],
        });

      await audit({
        actorUserId: session.user.id,
        action: "auth.wallet_link",
        targetType: "wallet",
        targetId: result.address!,
        metadata: { chain: "solana", method: "siws" },
        ip,
        userAgent: req.headers.get("user-agent"),
      });

      return WalletVerifyResponseSchema.parse({
        ok: true,
        address: result.address,
      });
    },
    { scope: `wallet:verify:${session.user.id}` },
  );

  return NextResponse.json(persisted);
}
