import type { ProcessClaimInput } from "@repo/shared";
import {
  linkStep,
  auditLink,
  loadActiveStep,
  drainStep,
} from "@/workflows/steps/processClaim-helpers";

/**
 * processClaim — on-demand workflow triggered from POST /api/claims/link.
 * Links the contributor's wallet, then drains any active escrow holdings.
 */
export async function processClaim(input: ProcessClaimInput): Promise<{
  drained: number;
  lamports: string;
}> {
  "use workflow";
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
