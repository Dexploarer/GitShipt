"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmModal } from "@/components/admin/DestructiveConfirmModal";
import { updateFeesBps } from "@/app/admin/actions";

export function FeesForm({ currentBps }: { currentBps: number }) {
  const [bps, setBps] = React.useState(currentBps);
  const [open, setOpen] = React.useState(false);
  const dirty = bps !== currentBps;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-label-sm text-fg-secondary">Current</span>
        <span className="text-mono-sm text-fg">{currentBps} bps · {(currentBps / 100).toFixed(2)}%</span>
      </div>
      <div className="space-y-2">
        <label className="flex items-center justify-between text-label-sm text-fg-secondary">
          <span>New value</span>
          <span className="text-mono-sm text-fg">{bps} bps · {(bps / 100).toFixed(2)}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={2000}
          step={25}
          value={bps}
          onChange={(e) => setBps(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-caption text-fg-muted">
          <span>0%</span>
          <span>10%</span>
          <span>20%</span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty}
          onClick={() => setOpen(true)}
        >
          Save fee
        </Button>
      </div>

      <DestructiveConfirmModal
        open={open}
        onOpenChange={setOpen}
        title="Update platform fee"
        description={
          <>
            New fee will be <span className="text-mono-sm">{bps} bps</span>{" "}
            (<span className="text-mono-sm">{(bps / 100).toFixed(2)}%</span>).
            Applies to every active project on the next snapshot.
          </>
        }
        targetName="platform.fees.bps"
        targetLabel="Type platform.fees.bps to confirm"
        confirmLabel="Save fee"
        action={async (p) => {
          await updateFeesBps({ bps, ...p });
        }}
      />
    </div>
  );
}
