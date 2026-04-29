import {
  acquireLockStep,
  releaseLockStep,
  reconcileStep,
  heartbeatStep,
} from "@/workflows/steps/reconcileFunds-helpers";

export async function reconcileFunds(): Promise<{
  status: "clean" | "warning" | "critical";
  manualReviewCount: number;
  finalizedSignatureCount: number;
}> {
  "use workflow";
  const lock = await acquireLockStep("reconcileFunds", "root", 15 * 60);
  if (!lock.acquired) {
    return {
      status: "warning",
      manualReviewCount: 0,
      finalizedSignatureCount: 0,
    };
  }
  try {
    const result = await reconcileStep();
    await heartbeatStep(result.status);
    return {
      status: result.status,
      manualReviewCount: result.manualReviewCount,
      finalizedSignatureCount: result.finalizedSignatureCount,
    };
  } finally {
    await releaseLockStep(lock);
  }
}
