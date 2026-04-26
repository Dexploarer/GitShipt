"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { Octokit } from "@octokit/rest";
import { auth } from "@/lib/auth";
import { dbPool } from "@/db";
import { accounts, projects, projectMemberships, users } from "@/db/schema";
import { check } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { hasCredentials, canLaunchOnBags, serverEnv } from "@/lib/env";
import { bags } from "@/lib/bags/client";
import { payoutSignerPublicKey } from "@/lib/solana/signer";
import { requirePermission, PermissionError } from "@/lib/auth/permissions";
import { updateProjectCaches } from "@/lib/cache-actions";
import { CreateProjectBodySchema, type CreateProjectBody } from "@repo/shared";

/**
 * Server action used by `<ReviewAndSign>` to drive the create + launch flow
 * in a single round-trip. The HTTP routes (POST /api/projects, POST
 * /api/projects/:id/launch) are still the stable public surface — this
 * action just composes them with shared logic.
 */

const PLATFORM_GH_USERNAME = "gitbags-platform";

export interface LaunchProgressUpdate {
  phase:
    | "creating-draft"
    | "uploading-metadata"
    | "configuring-fee-share"
    | "submitting-tx"
    | "persisting"
    | "done";
}

export interface LaunchActionResult {
  ok: true;
  projectId: string;
  tokenMint: string;
  status: "launch_configured" | "live" | "simulated_live";
  stub: boolean;
  configKey?: string;
  txSig: string | null;
  ghOwner: string;
  ghRepo: string;
  note?: string;
}

export interface LaunchActionError {
  ok: false;
  error: string;
  message: string;
  status: number;
}

/**
 * Create the draft project + immediately launch it via Bags. Single action so
 * the wizard's final-step UX shows progress without two network round-trips.
 *
 * Idempotent on `(userId, ghRepoId)` — calling twice for the same repo
 * returns the existing live token mint.
 */
export async function createAndLaunchAction(
  body: CreateProjectBody,
  idempotencyKey?: string,
): Promise<LaunchActionResult | LaunchActionError> {
  if (!hasCredentials.db()) {
    return {
      ok: false,
      error: "db_unavailable",
      message: "DB not configured.",
      status: 503,
    };
  }

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return {
      ok: false,
      error: "unauthorized",
      message: "Sign in with GitHub to launch.",
      status: 401,
    };
  }
  const userId = session.user.id;

  const limit = await check("project-create", `project-create:${userId}`);
  if (!limit.success) {
    return {
      ok: false,
      error: "rate_limited",
      message: "Project-create limit reached (3/hour).",
      status: 429,
    };
  }

  const parsed = CreateProjectBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_body",
      message: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
      status: 400,
    };
  }
  const validated = parsed.data;

  // Repo-admin re-verification (skipped in stub mode without GitHub creds).
  if (hasCredentials.github()) {
    const verifyResult = await verifyRepoAdmin({
      userId,
      ghOwner: validated.ghOwner,
      ghRepo: validated.ghRepo,
    });
    if (!verifyResult.ok) {
      return {
        ok: false,
        error: verifyResult.code,
        message: verifyResult.message,
        status: verifyResult.status,
      };
    }
  }

  const dbp = dbPool();
  const userRow = await dbp
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRow.length === 0) {
    return {
      ok: false,
      error: "user_missing",
      message: "Auth user not found in DB.",
      status: 401,
    };
  }

  const effectiveKey =
    idempotencyKey ?? `launch:${userId}:${validated.ghRepoId}`;

  try {
    const result = await withIdempotency<LaunchActionResult>(
      effectiveKey,
      async () => {
        // Insert project draft (or recover existing live row keyed on
        // (ghOwner, ghRepo) UNIQUE).
        let projectId: string;
        let isExistingLive = false;

        try {
          const txResult = await dbp.transaction(async (tx) => {
            const [inserted] = await tx
              .insert(projects)
              .values({
                ownerUserId: userId,
                ghOwner: validated.ghOwner,
                ghRepo: validated.ghRepo,
                ghRepoId: validated.ghRepoId,
                ghInstallationId: validated.ghInstallationId ?? null,
                name: validated.name,
                description: validated.description ?? null,
                imageUrl: validated.imageUrl,
                tokenWebsiteUrl: validated.website ?? null,
                tokenTwitterUrl: validated.twitter ?? null,
                tokenTelegramUrl: validated.telegram ?? null,
                status: "draft",
                platformFeeBps: validated.platformFeeBps,
                scoringConfig: validated.scoringConfig,
                payoutConfig: validated.payoutConfig,
              })
              .returning({ id: projects.id });

            if (!inserted) {
              throw new Error("Project insert returned no row.");
            }

            await tx.insert(projectMemberships).values({
              userId,
              projectId: inserted.id,
              role: "project_owner",
            });

            return inserted.id;
          });
          projectId = txResult;

          await audit({
            actorUserId: userId,
            action: "project.create",
            targetType: "project",
            targetId: projectId,
            metadata: {
              ghOwner: validated.ghOwner,
              ghRepo: validated.ghRepo,
              ghRepoId: validated.ghRepoId,
              platformFeeBps: validated.platformFeeBps,
            },
          });
        } catch (e) {
          // UNIQUE violation on (ghOwner, ghRepo) → recover an existing project.
          const message = e instanceof Error ? e.message : String(e);
          if (/projects_gh_repo_uq/i.test(message)) {
            const [existing] = await dbp
              .select({
                id: projects.id,
                status: projects.status,
                tokenMint: projects.tokenMint,
                bagsConfigKey: projects.bagsConfigKey,
              })
              .from(projects)
              .where(
                and(
                  eq(projects.ghOwner, validated.ghOwner),
                  eq(projects.ghRepo, validated.ghRepo),
                ),
              )
              .limit(1);
            if (!existing) throw e;
            projectId = existing.id;

            // If already launched, short-circuit.
            if (
              (existing.status === "live" ||
                existing.status === "simulated_live" ||
                existing.status === "launch_configured") &&
              existing.tokenMint
            ) {
              isExistingLive = true;
              return {
                ok: true,
                projectId,
                tokenMint: existing.tokenMint,
                status: existing.status,
                stub: existing.status === "simulated_live",
                configKey: existing.bagsConfigKey ?? undefined,
                txSig: null,
                ghOwner: validated.ghOwner,
                ghRepo: validated.ghRepo,
                note: "Existing live project — returned cached token mint.",
              } satisfies LaunchActionResult;
            }
          } else {
            throw e;
          }
        }

        if (isExistingLive) {
          // Already returned above.
          throw new Error("Unreachable");
        }

        // Authoritative permission check before launching.
        await requirePermission("project.update", { userId, projectId });

        // Bags step 1: token info
        const tokenInfo = await bags.createTokenInfo({
          name: validated.name,
          symbol: validated.symbol,
          description: validated.description ?? undefined,
          imageUrl: validated.imageUrl,
          website: validated.website,
          twitter: validated.twitter,
          telegram: validated.telegram,
        });
        const isStub = Boolean(tokenInfo.__stub);

        const payoutWallet = payoutSignerPublicKey();
        if (!isStub && !payoutWallet) {
          throw new ActionError(
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
          throw new ActionError(
            "pool_wallet_missing",
            "Unable to derive the Bags pool claimer wallet.",
            409,
          );
        }
        const payer = poolClaimerWallet;

        // Bags step 2: fee-share config
        const feeShareConfig = await bags.createFeeShareConfig({
          payer,
          baseMint: tokenInfo.tokenMint,
          feeClaimers: [
            {
              wallet: poolClaimerWallet,
              bps: 10_000 - validated.platformFeeBps,
            },
          ],
          platformFeeWallet: payoutWallet ?? undefined,
          shareFee: validated.platformFeeBps,
        });

        // Bags step 3: create, sign, and submit the final launch transaction.
        let txSig = feeShareConfig.txSignatures.at(-1) ?? null;
        let launchSignature: string | null = null;
        let note: string | undefined;
        if (isStub) {
          note =
            "Stub mode — token mint is fake; no on-chain transaction sent.";
        } else {
          const guard = canLaunchOnBags();
          if (!guard.ok) {
            throw new ActionError(
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

        // Persist token/config state. Real mode only reaches this point after
        // the Bags launch transaction is broadcast.
        const persistNow = new Date();
        await dbp
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
          .where(eq(projects.id, projectId));

        await audit({
          actorUserId: userId,
          action: "project.launch",
          targetType: "project",
          targetId: projectId,
          metadata: {
            tokenMint: tokenInfo.tokenMint,
            bagsConfigKey: feeShareConfig.configKey,
            stub: isStub,
            platformFeeBps: validated.platformFeeBps,
            feeShareConfigSignatures: feeShareConfig.txSignatures,
            launchSignature,
            launchWallet: isStub ? null : payer,
            poolClaimerWallet,
            initialBuyLamports: serverEnv().BAGS_INITIAL_BUY_LAMPORTS,
            cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
          },
        });

        // Wake up the env validator so misconfig surfaces here, not on the
        // first cron tick. Kept inside the action so it doesn't bloat the
        // hot path on subsequent calls.
        try {
          serverEnv();
        } catch {
          /* tolerated; non-fatal at this stage */
        }

        return {
          ok: true,
          projectId,
          tokenMint: tokenInfo.tokenMint,
          status: isStub ? "simulated_live" : "live",
          stub: isStub,
          configKey: feeShareConfig.configKey,
          txSig,
          ghOwner: validated.ghOwner,
          ghRepo: validated.ghRepo,
          note,
        } satisfies LaunchActionResult;
      },
      { scope: `launch:${userId}:${validated.ghRepoId}` },
    );

    // Revalidate the now-live public project page.
    revalidatePath(`/r/${result.ghOwner}/${result.ghRepo}`);
    await updateProjectCaches(
      result.projectId,
      `${result.ghOwner}/${result.ghRepo}`,
    );
    return result;
  } catch (e) {
    if (e instanceof ActionError) {
      return { ok: false, error: e.code, message: e.message, status: e.status };
    }
    if (e instanceof PermissionError) {
      return {
        ok: false,
        error: "forbidden",
        message: e.message,
        status: 403,
      };
    }
    const message = e instanceof Error ? e.message : "Launch failed.";
    console.error("[launch:action] failed:", e);
    return {
      ok: false,
      error: "launch_failed",
      message,
      status: 500,
    };
  }
}

class ActionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

interface VerifyOk {
  ok: true;
}
interface VerifyErr {
  ok: false;
  code: string;
  message: string;
  status: number;
}

async function verifyRepoAdmin(args: {
  userId: string;
  ghOwner: string;
  ghRepo: string;
}): Promise<VerifyOk | VerifyErr> {
  const dbp = dbPool();
  const [account] = await dbp
    .select({ accessToken: accounts.accessToken })
    .from(accounts)
    .where(
      and(eq(accounts.userId, args.userId), eq(accounts.providerId, "github")),
    )
    .limit(1);

  if (!account?.accessToken) {
    return {
      ok: false,
      code: "no_github_token",
      message: "GitHub OAuth token missing — sign out and back in.",
      status: 401,
    };
  }

  const octokit = new Octokit({ auth: account.accessToken });
  try {
    const { data } = await octokit.repos.get({
      owner: args.ghOwner,
      repo: args.ghRepo,
    });
    if (data.permissions?.admin !== true) {
      return {
        ok: false,
        code: "not_admin",
        message: "You must be a repo admin to launch.",
        status: 403,
      };
    }
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "GitHub repo lookup failed.";
    return {
      ok: false,
      code: "github_error",
      message,
      status: 502,
    };
  }
}

/**
 * Read-only helper used by `<RepoPicker>` server component or any other
 * place that wants to know if the user is signed in. Cheap; no rate limit.
 */
export async function getAuthedUserOrNull(): Promise<{
  id: string;
  name: string | null;
  email: string;
  image: string | null;
} | null> {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email,
    image: session.user.image ?? null,
  };
}
