import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { hasCredentials } from "@/lib/env";
import { encryptSecret, generateSecret } from "@/lib/auth/mfa";
import { check } from "@/lib/rate-limit";
import { withIdempotency } from "@/lib/idempotency";
import { MfaEnrollResponseSchema } from "@repo/shared";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/mfa/enroll
 *
 * Generates a fresh TOTP secret, encrypts it, persists it to
 * `users.mfaSecretEnc`, and returns a QR data URL + base32 string for
 * manual entry. Re-enrolling overwrites the prior secret — the user must
 * still call /verify with a fresh code to confirm before destructive
 * actions accept the enrollment.
 */
export async function POST(): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const h = await headers();
  const session = await auth().api.getSession({ headers: h });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  // Rate-limit enrollments to prevent enumeration / churn.
  const rl = await check("auth", `mfa-enroll:${userId}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rl.reset },
      { status: 429 },
    );
  }

  const result = await withIdempotency(
    h.get("idempotency-key"),
    async () => {
      const label = session.user.email || session.user.name || userId;
      const { secretBase32, uri } = generateSecret(label);
      const enc = await encryptSecret(secretBase32);

      await dbHttp
        .update(users)
        .set({ mfaSecretEnc: enc })
        .where(eq(users.id, userId));

      const qrDataUrl = await QRCode.toDataURL(uri, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 256,
      });

      await audit({
        actorUserId: userId,
        action: "auth.mfa_enroll",
        targetType: "user",
        targetId: userId,
        metadata: { reEnrolled: true },
        ip: h.get("x-forwarded-for"),
        userAgent: h.get("user-agent"),
      });

      return MfaEnrollResponseSchema.parse({ qrDataUrl, secretBase32 });
    },
    { scope: `auth:mfa-enroll:${userId}`, cacheResult: false },
  );

  return NextResponse.json(result, { status: 200 });
}
