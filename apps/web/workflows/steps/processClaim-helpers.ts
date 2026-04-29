import { audit } from "@/lib/audit";
import {
  linkContributorWallet,
  loadActiveEscrowFor,
  drainHoldingToWallet,
  type ActiveEscrowRow,
} from "./escrow-helpers";
import type { ProcessClaimInput } from "@repo/shared";
import { enterDbWorkflowContext } from "@/lib/db-rls";

export type { ActiveEscrowRow } from "./escrow-helpers";

export async function linkStep(input: ProcessClaimInput): Promise<void> {
  "use step";
  enterDbWorkflowContext("processClaim:link");
  await linkContributorWallet({
    contributorId: input.contributorId,
    userId: input.userId,
    walletAddress: input.walletAddress,
  });
}

export async function auditLink(input: ProcessClaimInput): Promise<void> {
  "use step";
  enterDbWorkflowContext("processClaim:auditLink");
  await audit({
    actorUserId: input.userId,
    action: "auth.wallet_link",
    targetType: "contributor",
    targetId: input.contributorId,
    metadata: { walletAddress: input.walletAddress },
  });
}

export async function loadActiveStep(
  contributorId: string,
): Promise<ActiveEscrowRow[]> {
  "use step";
  enterDbWorkflowContext("processClaim:loadActive");
  return await loadActiveEscrowFor(contributorId);
}

export async function drainStep(args: {
  holdingId: string;
  walletAddress: string;
}): Promise<{ status: string; sig?: string }> {
  "use step";
  enterDbWorkflowContext("processClaim:drain");
  return await drainHoldingToWallet(args);
}
