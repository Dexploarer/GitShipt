import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { dbPool } from "@/db";
import { projects } from "@/db/schema";
import { requirePermission, PermissionError } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import {
  hasCredentials,
  canLaunchOnBags,
  serverEnv,
  stubsAllowed,
} from "@/lib/env";
import { bags } from "@/lib/bags/client";
import { payoutSignerPublicKey } from "@/lib/solana/signer";
import { LaunchProjectResponseSchema } from "@repo/shared";
import { revalidateProjectCaches } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Default platform GitHub username used as the pool fee claimer at launch.
 * Resolves to the platform's pool wallet via Bags identity routing.
 *
 * In stub mode this is just a placeholder string the stub doesn't care about.
 */
const PLATFORM_GH_USERNAME = "gitbags-platform";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/{id}/launch — fire the Bags launch flow.
 *
 * Steps:
 *   1. Authenticate; require `project.update` for the project (the user is
 *      the creator and was inserted as `project_owner` in /api/projects).
 *   2. Read draft row; must be in `draft` status.
 *   3. `bags.createTokenInfo` — uploads metadata, returns tokenMint.
 *   4. `bags.createFeeShareConfig` — registers the direct pool wallet fee
 *      claimers, signs fee-share config transactions, returns configKey.
 *   5. Create/sign/broadcast the final Bags launch transaction.
 *   6. Persist live launch state and audit `project.launch`.
 *
 * Wrapped end-to-end in `withIdempotency()`.
 *
 * Stub-safe: when BAGS_API_KEY is absent, persists `__stub: true` token
 * mints and marks the project live with a note. Refuses live launch when
 * `canLaunchOnBags()` says no (e.g. devnet + prod key with no opt-in).
 */
export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const params = await ctx.params;
  const projectId = params.id;
  if (!projectId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent");

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    await requirePermission("project.update", { userId, projectId });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json(
        { error: "forbidden", message: e.message },
        { status: 403 },
      );
    }
    throw e;
  }

  const rawIdempotencyKey = req.headers.get("idempotency-key");

  // Peek at project state BEFORE entering withIdempotency so we can namespace
  // the cache key per-mode. Otherwise a stub-mode response is cached and any
  // later real-launch attempt returns the cached fake mint forever.
  const dbpForPeek = dbPool();
  const [peek] = await dbpForPeek
    .select({
      status: projects.status,
      simulatedAt: projects.simulatedAt,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  // Real-mode and each simulated cycle land in separate idempotency spaces.
  // Promoting a simulated_live project to a real launch never returns a
  // cached stub response.
  const willStubMode = !canLaunchOnBags().ok || !hasCredentials.bags();
  if (willStubMode && !stubsAllowed()) {
    const guard = canLaunchOnBags();
    return NextResponse.json(
      {
        error: "live_credentials_required",
        message: guard.ok ? "BAGS_API_KEY missing" : guard.reason,
      },
      { status: 503 },
    );
  }
  const namespace = willStubMode
    ? `sim:${peek?.simulatedAt?.toISOString() ?? "first"}`
    : "real";
  const idempotencyKey = rawIdempotencyKey
    ? `${projectId}:${namespace}:${rawIdempotencyKey}`
    : null;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      async () => {
        const dbp = dbPool();

        const [project] = await dbp
          .select()
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1);

        if (!project) {
          throw new LaunchError("not_found", "Project not found.", 404);
        }

        // Promote-from-stub: when a simulated_live project hits this route in
        // real mode, clear the stub artifacts and re-run the launch. The
        // tokenMint on a simulated_live row is a placeholder, not real
        // on-chain state — overwriting it is intentional.
        const isPromotingFromStub =
          project.status === "simulated_live" && !willStubMode;

        if (isPromotingFromStub) {
          await dbp
            .update(projects)
            .set({
              tokenMint: null,
              bagsLaunchId: null,
              bagsConfigKey: null,
              bagsLaunchSignature: null,
              bagsLaunchWallet: null,
              bagsPoolClaimerWallet: null,
              bagsTokenMetadata: null,
              bagsInitialBuyLamports: 0,
              status: "draft",
              simulatedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(projects.id, projectId));
          const [reloaded] = await dbp
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);
          if (reloaded) Object.assign(project, reloaded);
        }

        if (project.status === "launch_configured" && !willStubMode) {
          const payoutWallet = payoutSignerPublicKey();
          const launchWallet = project.bagsLaunchWallet ?? payoutWallet;
          if (
            !project.tokenMint ||
            !project.bagsConfigKey ||
            !project.bagsTokenMetadata ||
            !launchWallet
          ) {
            throw new LaunchError(
              "launch_config_incomplete",
              "Stored Bags launch configuration is missing metadata, config key, token mint, or launch wallet.",
              409,
            );
          }

          const launch = await bags.createAndSubmitLaunchTransaction({
            tokenMint: project.tokenMint,
            metadataUrl: project.bagsTokenMetadata,
            configKey: project.bagsConfigKey,
            launchWallet,
            initialBuyLamports:
              project.bagsInitialBuyLamports ??
              serverEnv().BAGS_INITIAL_BUY_LAMPORTS,
          });
          const persistNow = new Date();
          await dbp
            .update(projects)
            .set({
              bagsLaunchId: launch.signature,
              bagsLaunchSignature: launch.signature,
              bagsLaunchWallet: launchWallet,
              status: "live",
              simulatedAt: null,
              updatedAt: persistNow,
            })
            .where(eq(projects.id, projectId));

          await audit({
            actorUserId: userId,
            action: "project.launch_complete",
            targetType: "project",
            targetId: projectId,
            metadata: {
              tokenMint: project.tokenMint,
              bagsConfigKey: project.bagsConfigKey,
              launchSignature: launch.signature,
              launchWallet,
              initialBuyLamports:
                project.bagsInitialBuyLamports ??
                serverEnv().BAGS_INITIAL_BUY_LAMPORTS,
              cluster: serverEnvCluster(),
            },
            ip,
            userAgent,
          });

          return LaunchProjectResponseSchema.parse({
            projectId,
            tokenMint: project.tokenMint,
            status: "live",
            stub: false,
            configKey: project.bagsConfigKey,
            txSig: launch.signature,
            note: "Bags launch transaction broadcast. Token is live.",
          });
        }

        if (project.status !== "draft") {
          // Already launched (or paused/killed) — return the existing token mint
          // so the wizard can navigate to /r/{org}/{repo} idempotently.
          if (project.tokenMint) {
            return LaunchProjectResponseSchema.parse({
              projectId,
              tokenMint: project.tokenMint,
              status:
                project.status === "simulated_live"
                  ? "simulated_live"
                  : project.status === "launch_configured"
                    ? "launch_configured"
                    : "live",
              stub: project.status === "simulated_live",
              configKey: project.bagsConfigKey ?? undefined,
              txSig: null,
              note: `Project status is ${project.status}; returning persisted token mint.`,
            });
          }
          throw new LaunchError(
            "bad_status",
            `Project is in ${project.status} status; cannot launch.`,
            409,
          );
        }

        // Step 1: token info (uploads metadata, returns tokenMint).
        const tokenInfo = await bags.createTokenInfo({
          name: project.name,
          symbol: deriveSymbolFromName(project.name),
          description: project.description ?? undefined,
          imageUrl: project.imageUrl ?? "https://gitbags.xyz/og/default.png",
          website: project.tokenWebsiteUrl ?? undefined,
          twitter: project.tokenTwitterUrl ?? undefined,
          telegram: project.tokenTelegramUrl ?? undefined,
        });
        const isStub = Boolean(tokenInfo.__stub);

        // Step 2: fee-share config.
        // Payer is the platform hot wallet — when SOLANA_PAYOUT_KEYPAIR is
        // missing we fall back to the resolved pool wallet so the SDK
        // payload still validates (in stub mode the value is unused anyway).
        const payoutWallet = payoutSignerPublicKey();
        if (!isStub && !payoutWallet) {
          throw new LaunchError(
            "launch_wallet_missing",
            "SOLANA_PAYOUT_KEYPAIR is required before live Bags launch.",
            409,
          );
        }
        const stubPoolWallet = isStub
          ? (await bags.resolveWallet("github", PLATFORM_GH_USERNAME)).wallet
          : null;
        const poolClaimerWallet = payoutWallet ?? stubPoolWallet;
        if (!poolClaimerWallet) {
          throw new LaunchError(
            "pool_wallet_missing",
            "Unable to derive the Bags pool claimer wallet.",
            409,
          );
        }
        const payer = poolClaimerWallet;

        const feeShareConfig = await bags.createFeeShareConfig({
          payer,
          baseMint: tokenInfo.tokenMint,
          feeClaimers: [
            {
              wallet: poolClaimerWallet,
              bps: 10_000 - project.platformFeeBps,
            },
          ],
          platformFeeWallet: payoutWallet ?? undefined,
          shareFee: project.platformFeeBps,
        });

        // Step 3: create, sign, and submit the final launch transaction.
        let txSig = feeShareConfig.txSignatures.at(-1) ?? null;
        let launchSignature: string | null = null;
        let note: string | undefined;

        if (isStub) {
          note =
            "Stub mode — token mint is fake; no on-chain transaction sent.";
        } else {
          const guard = canLaunchOnBags();
          if (!guard.ok) {
            throw new LaunchError(
              "launch_refused",
              `Refusing on-chain launch: ${guard.reason}`,
              409,
            );
          }
          const launch = await bags.createAndSubmitLaunchTransaction({
            tokenMint: tokenInfo.tokenMint,
            metadataUrl: tokenInfo.tokenMetadata,
            configKey: feeShareConfig.configKey,
            launchWallet: payer,
            initialBuyLamports: serverEnv().BAGS_INITIAL_BUY_LAMPORTS,
          });
          launchSignature = launch.signature;
          txSig = launch.signature;
          note = "Bags launch transaction broadcast. Token is live.";
        }

        // Step 4: persist token/config state (atomic with the audit row that
        // follows). Real mode only reaches this point after the Bags launch tx.
        // STUB MODE: write `simulated_live` and stamp `simulated_at` so a later
        // real-mode launch can promote this row instead of being blocked.
        const persistNow = new Date();
        const [updated] = await dbp
          .update(projects)
          .set({
            tokenMint: tokenInfo.tokenMint,
            bagsLaunchId: isStub ? feeShareConfig.configKey : launchSignature,
            bagsConfigKey: feeShareConfig.configKey,
            bagsLaunchSignature: launchSignature,
            bagsLaunchWallet: isStub ? null : payer,
            bagsPoolClaimerWallet: poolClaimerWallet,
            bagsTokenMetadata: tokenInfo.tokenMetadata,
            bagsInitialBuyLamports: serverEnv().BAGS_INITIAL_BUY_LAMPORTS,
            status: isStub ? "simulated_live" : "live",
            simulatedAt: isStub ? persistNow : null,
            updatedAt: persistNow,
          })
          .where(eq(projects.id, projectId))
          .returning({ id: projects.id, tokenMint: projects.tokenMint });

        if (!updated) {
          throw new LaunchError(
            "update_failed",
            "Failed to persist launch.",
            500,
          );
        }

        await audit({
          actorUserId: userId,
          action: "project.launch",
          targetType: "project",
          targetId: projectId,
          metadata: {
            tokenMint: tokenInfo.tokenMint,
            bagsConfigKey: feeShareConfig.configKey,
            stub: isStub,
            platformFeeBps: project.platformFeeBps,
            feeShareConfigSignatures: feeShareConfig.txSignatures,
            launchSignature,
            launchWallet: isStub ? null : payer,
            poolClaimerWallet,
            initialBuyLamports: serverEnv().BAGS_INITIAL_BUY_LAMPORTS,
            cluster: serverEnvCluster(),
          },
          ip,
          userAgent,
        });

        return LaunchProjectResponseSchema.parse({
          projectId,
          tokenMint: tokenInfo.tokenMint,
          status: isStub ? "simulated_live" : "live",
          stub: isStub,
          configKey: feeShareConfig.configKey,
          txSig,
          note,
        });
      },
      { scope: `project:launch:${projectId}` },
    );

    await revalidateProjectCaches(projectId);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof LaunchError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: e.status },
      );
    }
    const message = e instanceof Error ? e.message : "Launch failed.";
    console.error("[projects:launch] failed:", e);
    return NextResponse.json(
      { error: "launch_failed", message },
      { status: 500 },
    );
  }
}

class LaunchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "LaunchError";
  }
}

/**
 * Derive a Bags-compliant symbol from a project name when the original
 * symbol isn't on the project row (we store name on the row but the
 * launch route needs an upper-case alphanumeric ticker for Bags).
 */
function deriveSymbolFromName(name: string): string {
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return cleaned || "GBAGS";
}

function serverEnvCluster(): string {
  // Avoid pulling clientEnv (which validates client-only vars) into a server
  // context; just read NEXT_PUBLIC_SOLANA_CLUSTER directly. Falls back to
  // 'devnet' to keep audit metadata informative even when not configured.
  // Touch serverEnv() so the env validation runs at least once on the path.
  try {
    serverEnv();
  } catch {
    // ignore; we still want the cluster string for the audit log
  }
  return process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
}
