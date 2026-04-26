"use client";

import { useState, useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pauseProject } from "../../actions";

export function PauseSection({
  projectId,
  status,
  pausedReason,
}: {
  projectId: string;
  status: "draft" | "live" | "paused" | "killed" | "simulated_live";
  pausedReason: string | null;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState(pausedReason ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isPaused = status === "paused";
  const isKilled = status === "killed";

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      try {
        await pauseProject({
          projectId,
          pause: !isPaused,
          reason: !isPaused ? reason || undefined : undefined,
          idempotencyKey: `pause-${projectId}-${Date.now()}`,
        });
        setConfirmOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Toggle failed");
      }
    });
  }

  if (isKilled) {
    return (
      <p className="text-body-sm text-fg-secondary">
        Project is killed and cannot be paused or resumed.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-label-sm text-fg-secondary">Current status:</span>
        {isPaused ? (
          <Badge variant="warning" size="sm">Paused</Badge>
        ) : (
          <Badge variant="success" dot size="sm">Live</Badge>
        )}
      </div>

      {!confirmOpen ? (
        <Button
          type="button"
          variant={isPaused ? "primary" : "secondary"}
          onClick={() => setConfirmOpen(true)}
        >
          {isPaused ? (
            <>
              <Play className="size-4" /> Resume project
            </>
          ) : (
            <>
              <Pause className="size-4" /> Pause project
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-border-strong bg-surface-elevated px-4 py-3">
          {!isPaused ? (
            <label className="grid gap-1">
              <span className="text-label-sm text-fg-secondary">
                Reason (optional, shown on the public page)
              </span>
              <input
                type="text"
                value={reason}
                maxLength={280}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-body-md text-fg outline-none focus:border-primary"
                placeholder="e.g. migrating maintainer keys"
              />
            </label>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isPaused ? "primary" : "danger"}
              onClick={handleToggle}
              disabled={pending}
            >
              {pending
                ? "Working..."
                : isPaused
                ? "Confirm resume"
                : "Confirm pause"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
          {error ? (
            <p className="text-body-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
