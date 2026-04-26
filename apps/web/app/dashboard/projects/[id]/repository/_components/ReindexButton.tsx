"use client";

import * as React from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@repo/ui";

export interface ReindexButtonProps {
  projectId: string;
  /** When false, render the button as disabled with a tooltip-style hint. */
  installed: boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; runId: string | null }
  | { kind: "error"; message: string };

/**
 * Manual re-index trigger. Posts to `/api/projects/[id]/reindex`, then shows
 * an inline status line (no toast lib in the project). The server enqueues
 * a `indexProjectDeltas` workflow run; the visible result on the
 * leaderboard catches up with the next ~15min indexer beat.
 */
export function ReindexButton({ projectId, installed }: ReindexButtonProps) {
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  async function onClick() {
    if (status.kind === "loading") return;
    setStatus({ kind: "loading" });
    try {
      const res = await fetch(`/api/projects/${projectId}/reindex`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setStatus({
          kind: "error",
          message: body.message ?? body.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        runId?: string | null;
      };
      setStatus({ kind: "ok", runId: data.runId ?? null });
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    }
  }

  const disabled = !installed || status.kind === "loading";
  const label =
    status.kind === "loading" ? "Re-indexing…" : "Re-index now";

  return (
    <div className="space-y-1.5">
      <Button
        variant="secondary"
        onClick={onClick}
        disabled={disabled}
        title={
          !installed
            ? "Install the GitHub App first"
            : "Trigger a manual indexer run"
        }
      >
        <RefreshCw
          className={
            status.kind === "loading"
              ? "size-4 animate-spin"
              : "size-4"
          }
        />{" "}
        {label}
      </Button>
      {status.kind === "ok" ? (
        <p className="text-caption text-success inline-flex items-center gap-1">
          <CheckCircle2 className="size-3" />
          Queued{status.runId ? ` (${status.runId.slice(0, 8)})` : ""} ·
          contributors will refresh in ~15min.
        </p>
      ) : status.kind === "error" ? (
        <p className="text-caption text-danger inline-flex items-center gap-1">
          <XCircle className="size-3" />
          {status.message}
        </p>
      ) : (
        <p className="text-caption text-fg-muted">
          The 15-minute cron handles routine catch-up; use this after fresh
          installs or to verify fixes.
        </p>
      )}
    </div>
  );
}
