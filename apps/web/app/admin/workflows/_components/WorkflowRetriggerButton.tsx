"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { Button } from "@repo/ui";
import { retriggerWorkflow } from "@/app/admin/actions";

type WorkflowName =
  | "healthPulse"
  | "indexGithubDeltas"
  | "computeLeaderboard"
  | "takeSnapshot"
  | "executePayout"
  | "expireEscrow"
  | "processClaim";

export function WorkflowRetriggerButton({
  name,
  disabled,
}: {
  name: WorkflowName;
  disabled: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function fire() {
    setBusy(true);
    setErr(null);
    try {
      await retriggerWorkflow({ name });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={disabled ? "ghost" : "secondary"}
        onClick={fire}
        disabled={disabled || busy}
        title={disabled ? "Needs arguments — use the per-project trigger." : undefined}
      >
        <Play className="size-3.5" /> {busy ? "Sending..." : "Re-trigger"}
      </Button>
      {err ? <span className="text-caption text-danger">{err}</span> : null}
    </div>
  );
}
