"use client";

import * as React from "react";
import { Ban, Play, RotateCcw } from "lucide-react";
import { Button } from "@repo/ui";
import { DestructiveConfirmModal } from "@/components/admin/DestructiveConfirmModal";
import { cancelPayout, retryPayout } from "@/app/admin/actions";

export function PayoutRowActions({
  payoutId,
  status,
  snapshotId,
}: {
  payoutId: string;
  status: string;
  snapshotId: string;
}) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const canRetry = status === "failed";
  const canCancel = ["pending", "claiming", "distributing"].includes(status);

  async function doRetry() {
    setBusy(true);
    try {
      await retryPayout({
        payoutId,
        idempotencyKey: `payout-retry-${payoutId}-${Date.now()}`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={!canRetry || busy}
        onClick={doRetry}
        title={
          canRetry
            ? "Retry failed payout"
            : "Only failed payouts can be retried"
        }
      >
        <RotateCcw className="size-3.5" /> Retry
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={!canCancel || busy}
        onClick={() => setCancelOpen(true)}
        title={
          canCancel
            ? "Force-cancel pending payout"
            : "Cannot cancel terminal payout"
        }
      >
        <Ban className="size-3.5" /> Cancel
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled
        title="Manual snapshot trigger ships in v1.1 once Agent B's processSnapshotPayout workflow is wired."
      >
        <Play className="size-3.5" /> Snap → pay
      </Button>
      <span className="sr-only">Snapshot {snapshotId}</span>
      <DestructiveConfirmModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Force-cancel payout"
        description={
          <>
            Marks this payout as <code className="text-mono-sm">cancelled</code>
            . Any inflight on-chain claim will not be reversed automatically.
          </>
        }
        targetName={payoutId}
        targetLabel="Type the payout id to confirm"
        confirmLabel="Cancel payout"
        action={async (p) => {
          await cancelPayout({ payoutId, ...p });
        }}
      />
    </div>
  );
}
