import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { start } from "workflow/api";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { wallets, contributors, accounts } from "@/db/schema";
import { processClaim } from "@/workflows/processClaim";
import { ClaimLinkRequestSchema } from "@/shared/payout-schemas";
import { audit } from "@/lib/audit";
import { hasCredentials } from "@/lib/env";
import {
  revalidateContributorCaches,
  revalidateProjectCaches,
} from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/claims/link
 *
 * Body: { contributorId, walletAddress }
 *
 * Verifies:
 *   - active better-auth session
 *   - the wallet is already SIWS-verified for this user (wallets row exists)
 *   - the contributor's gh_user_id matches a github account on this user
 *
 * Then triggers the `processClaim` workflow which links the wallet and
 * drains active escrow holdings.
 */
export async function POST(req: Request): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "auth_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ClaimLinkRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Verify the wallet belongs to this user and is SIWS-verified.
  const [walletRow] = await dbHttp
    .select({ address: wallets.address })
    .from(wallets)
    .where(
      and(
        eq(wallets.userId, userId),
        eq(wallets.address, parsed.data.walletAddress),
      ),
    )
    .limit(1);

  if (!walletRow) {
    return NextResponse.json(
      { error: "wallet_not_verified" },
      { status: 403 },
    );
  }

  // Verify the contributor's gh_user_id matches a github account on this user.
  const [contributorRow] = await dbHttp
    .select({
      ghUserId: contributors.ghUserId,
      ghUsername: contributors.ghUsername,
      projectId: contributors.projectId,
    })
    .from(contributors)
    .where(eq(contributors.id, parsed.data.contributorId))
    .limit(1);

  if (!contributorRow) {
    return NextResponse.json({ error: "contributor_not_found" }, { status: 404 });
  }

  const [githubAccount] = await dbHttp
    .select({ accountId: accounts.accountId })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.providerId, "github"),
        eq(accounts.accountId, contributorRow.ghUserId),
      ),
    )
    .limit(1);

  if (!githubAccount) {
    return NextResponse.json(
      { error: "github_identity_mismatch" },
      { status: 403 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await audit({
    actorUserId: userId,
    action: "auth.wallet_link",
    targetType: "contributor",
    targetId: parsed.data.contributorId,
    metadata: {
      walletAddress: parsed.data.walletAddress,
      via: "claims.link",
    },
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  const run = await start(processClaim, [
    {
      contributorId: parsed.data.contributorId,
      userId,
      walletAddress: parsed.data.walletAddress,
    },
  ]);

  await revalidateProjectCaches(contributorRow.projectId);
  revalidateContributorCaches([contributorRow.ghUsername]);

  return NextResponse.json({ ok: true, runId: run.runId });
}
