import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { start } from "workflow/api";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import {
  wallets,
  contributors,
  contributorClaims,
  escrowHoldings,
  projects,
} from "@/db/schema";
import { processClaim } from "@/workflows/processClaim";
import { audit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { hasCredentials } from "@/lib/env";
import {
  revalidateContributorCaches,
  revalidateProjectCaches,
} from "@/lib/cache";
import { ClaimEscrowRequestSchema } from "@repo/shared";

export const dynamic = "force-dynamic";

interface DrainedItem {
  projectSlug: string;
  lamports: string;
  jobId: string;
}

interface DrainResult {
  status: number;
  body:
    | { ok: true; drained: DrainedItem[] }
    | { error: string; message?: string };
}

/**
 * POST /api/claims/escrow
 *
 * Manual on-demand escrow drain. For each (contributor, wallet) pair the
 * caller has claimed, kicks off a `processClaim` workflow that re-verifies
 * the link and drains any active holdings. Optionally narrows to a single
 * project via the `projectId` body field.
 *
 * Auth: better-auth session (no admin scope — users only ever see their own
 * contributor rows because the join goes through `contributor_claims`).
 *
 * Idempotency: respects the `Idempotency-Key` request header (24h window,
 * see `lib/idempotency.ts`). Resubmitting the same key returns the same
 * result envelope.
 */
export async function POST(req: Request): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let raw: unknown = {};
  try {
    // Body is optional — empty POST is allowed (drain all eligible).
    const text = await req.text();
    raw = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ClaimEscrowRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const projectFilter = parsed.data.projectId ?? null;

  const idemKey = req.headers.get("idempotency-key");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent");

  const result = await withIdempotency<DrainResult>(idemKey, async () => {
    // 1. Wallet pre-check.
    const userWallets = await dbHttp
      .select({ address: wallets.address })
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(5);

    if (userWallets.length === 0) {
      return {
        status: 400,
        body: {
          error: "no_wallet_linked",
          message: "Link a Solana wallet first",
        },
      };
    }

    // 2. Find contributor claims for this user.
    const claimRows = await dbHttp
      .select({
        contributorId: contributorClaims.contributorId,
        walletAddress: contributorClaims.walletAddress,
      })
      .from(contributorClaims)
      .where(eq(contributorClaims.userId, userId));

    if (claimRows.length === 0) {
      return { status: 200, body: { ok: true, drained: [] } };
    }

    // 3. Pull project metadata + escrow totals for those contributors,
    //    optionally filtered by project.
    const contribIds = claimRows.map((c) => c.contributorId);

    const escrowAgg = await dbHttp
      .select({
        contributorId: escrowHoldings.contributorId,
        ghUsername: contributors.ghUsername,
        projectId: contributors.projectId,
        projectSlug: sql<string>`${projects.ghOwner} || '/' || ${projects.ghRepo}`,
        lamports: sql<string>`coalesce(sum(${escrowHoldings.amountLamports}), 0)::text`,
      })
      .from(escrowHoldings)
      .innerJoin(
        contributors,
        eq(contributors.id, escrowHoldings.contributorId),
      )
      .innerJoin(projects, eq(projects.id, contributors.projectId))
      .where(
        and(
          inArray(escrowHoldings.contributorId, contribIds),
          isNull(escrowHoldings.drainedAt),
          projectFilter ? eq(contributors.projectId, projectFilter) : undefined,
        ),
      )
      .groupBy(
        escrowHoldings.contributorId,
        contributors.ghUsername,
        contributors.projectId,
        projects.ghOwner,
        projects.ghRepo,
      );

    const eligible = escrowAgg.filter((r) => BigInt(r.lamports) > 0n);
    if (eligible.length === 0) {
      return { status: 200, body: { ok: true, drained: [] } };
    }

    // Fast lookup for which wallet was last linked per contributor (fall
    // back to user's first verified wallet).
    const claimWalletByContrib = new Map(
      claimRows.map((c) => [c.contributorId, c.walletAddress]),
    );
    const fallbackWallet = userWallets[0]!.address;

    const drained: DrainedItem[] = [];
    for (const row of eligible) {
      const walletAddress =
        claimWalletByContrib.get(row.contributorId) ?? fallbackWallet;

      // Verify the chosen wallet is still owned by this user.
      const owned = userWallets.some((w) => w.address === walletAddress);
      if (!owned) continue;

      const run = await start(processClaim, [
        {
          contributorId: row.contributorId,
          userId,
          walletAddress,
        },
      ]);

      await audit({
        actorUserId: userId,
        action: "claim.escrow_drained",
        targetType: "project",
        targetId: row.projectId,
        metadata: {
          projectSlug: row.projectSlug,
          contributorId: row.contributorId,
          lamports: row.lamports,
          walletAddress,
          jobId: run.runId,
          source: "manual",
        },
        ip,
        userAgent,
      });

      drained.push({
        projectSlug: row.projectSlug,
        lamports: row.lamports,
        jobId: run.runId,
      });
    }

    const invalidatedProjects = new Map<string, string>();
    const invalidatedContributors = new Set<string>();
    for (const row of eligible) {
      invalidatedProjects.set(row.projectId, row.projectSlug);
      invalidatedContributors.add(row.ghUsername);
    }
    await Promise.all(
      Array.from(invalidatedProjects, ([projectId, slug]) =>
        revalidateProjectCaches(projectId, slug),
      ),
    );
    revalidateContributorCaches(invalidatedContributors);

    return { status: 200, body: { ok: true, drained } };
  });

  return NextResponse.json(result.body, { status: result.status });
}
