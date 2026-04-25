"use workflow";

import { audit } from "@/lib/audit";
import {
  linkContributorWallet,
  loadActiveEscrowFor,
  drainHoldingToWallet,
  type ActiveEscrowRow,
} from "./steps/escrow-helpers";
import type { ProcessClaimInput } from "@/shared/payout-schemas";

/**
 * processClaim — on-demand workflow triggered from POST /api/claims/link.
 * Links the contributor's wallet, then drains any active escrow holdings.
 */
export async function processClaim(input: ProcessClaimInput): Promise<{
  drained: number;
  lamports: string;
}> {
  await linkStep(input);
  await auditLink(input);

  const holdings = await loadActiveStep(input.contributorId);

  let totalLamports = 0n;
  let drained = 0;
  for (const h of holdings) {
    const result = await drainStep({
      holdingId: h.id,
      walletAddress: input.walletAddress,
    });
    if (result.status === "drained") {
      totalLamports += BigInt(h.amountLamports);
      drained++;
    }
  }

  return { drained, lamports: totalLamports.toString() };
}

// ============================================================
// Steps
// ============================================================

async function linkStep(input: ProcessClaimInput): Promise<void> {
  "use step";
  await linkContributorWallet({
    contributorId: input.contributorId,
    userId: input.userId,
    walletAddress: input.walletAddress,
  });
}

async function auditLink(input: ProcessClaimInput): Promise<void> {
  "use step";
  await audit({
    actorUserId: input.userId,
    action: "auth.wallet_link",
    targetType: "contributor",
    targetId: input.contributorId,
    metadata: { walletAddress: input.walletAddress },
  });
}

async function loadActiveStep(
  contributorId: string,
): Promise<ActiveEscrowRow[]> {
  "use step";
  return await loadActiveEscrowFor(contributorId);
}

async function drainStep(args: {
  holdingId: string;
  walletAddress: string;
}): Promise<{ status: string; sig?: string }> {
  "use step";
  return await drainHoldingToWallet(args);
}
