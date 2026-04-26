import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { hasCredentials } from "@/lib/env";
import {
  clearMfaConfirmed,
  decryptSecret,
  verifyTotp,
} from "@/lib/auth/mfa";
import { check } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  token: z.string().regex(/^\d{6}$/, "must be 6 digits"),
});

/**
 * POST /api/auth/mfa/revoke
 *
 * Removes the user's TOTP secret. Requires a valid current code so a
 * stolen session cookie cannot remove the second factor and downgrade
 * account security.
 */
export async function POST(req: Request): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const h = await headers();
  const session = await auth().api.getSession({ headers: h });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const rl = await check("auth", `mfa-revoke:${userId}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rl.reset },
      { status: 429 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_body", details: (e as Error).message },
      { status: 400 },
    );
  }

  const [row] = await dbHttp
    .select({ mfaSecretEnc: users.mfaSecretEnc })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.mfaSecretEnc) {
    return NextResponse.json({ error: "not_enrolled" }, { status: 400 });
  }

  let secretBase32: string;
  try {
    secretBase32 = await decryptSecret(row.mfaSecretEnc);
  } catch {
    return NextResponse.json({ error: "secret_unreadable" }, { status: 500 });
  }

  if (!verifyTotp(secretBase32, body.token)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  await dbHttp
    .update(users)
    .set({ mfaSecretEnc: null })
    .where(eq(users.id, userId));

  await clearMfaConfirmed(userId);

  await audit({
    actorUserId: userId,
    action: "auth.mfa_revoke",
    targetType: "user",
    targetId: userId,
    metadata: {},
    ip: h.get("x-forwarded-for"),
    userAgent: h.get("user-agent"),
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
