"use client";

import * as React from "react";
import { Power } from "lucide-react";
import { Button } from "@repo/ui";
import { DestructiveConfirmModal } from "@/components/admin/DestructiveConfirmModal";
import { toggleKillSwitch } from "@/app/admin/actions";

export function KillSwitchPanel({
  currentEnabled,
}: {
  currentEnabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const targetEnabled = !currentEnabled;
  const targetName = targetEnabled
    ? "ENABLE KILL SWITCH"
    : "DISABLE KILL SWITCH";

  return (
    <div className="flex items-center justify-end">
      <Button
        variant={targetEnabled ? "danger" : "secondary"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Power className="size-4" />{" "}
        {targetEnabled ? "Enable kill switch" : "Disable kill switch"}
      </Button>
      <DestructiveConfirmModal
        open={open}
        onOpenChange={setOpen}
        title={targetEnabled ? "Enable kill switch" : "Disable kill switch"}
        description={
          targetEnabled
            ? "Every workflow halts on its next run. New launches blocked. Used for security incidents only."
            : "Workflows resume on their next scheduled tick. Confirm the original incident is fully resolved."
        }
        targetName={targetName}
        targetLabel={`Type "${targetName}" to confirm`}
        confirmLabel={targetEnabled ? "Enable" : "Disable"}
        action={async (p) => {
          return await toggleKillSwitch({ enabled: targetEnabled, ...p });
        }}
        successToast={
          targetEnabled
            ? "Platform kill switch ENABLED — workflows paused"
            : "Platform kill switch DISABLED — workflows resumed"
        }
      />
    </div>
  );
}
