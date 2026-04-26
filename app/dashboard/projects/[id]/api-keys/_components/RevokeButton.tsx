"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RevokeButtonProps {
  projectId: string;
  keyId: string;
  keyName: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

/**
 * Two-tap revoke control. First click flips into a confirm state with a
 * "Confirm revoke" button; second click DELETEs the key and refreshes the
 * page so the row disappears.
 */
export function RevokeButton({ projectId, keyId, keyName }: RevokeButtonProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  async function doRevoke() {
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch(
        `/api/projects/${projectId}/api-keys/${keyId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setStatus({
          kind: "error",
          message: body.message ?? body.error ?? `Failed (${res.status}).`,
        });
        return;
      }
      router.refresh();
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    }
  }

  if (status.kind === "confirming" || status.kind === "submitting") {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-caption text-fg-secondary hidden sm:inline">
          Revoke {keyName}?
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setStatus({ kind: "idle" })}
          disabled={status.kind === "submitting"}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={doRevoke}
          disabled={status.kind === "submitting"}
        >
          {status.kind === "submitting" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Revoking…
            </>
          ) : (
            "Confirm revoke"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setStatus({ kind: "confirming" })}
        aria-label={`Revoke API key ${keyName}`}
      >
        <Trash2 className="size-3.5" aria-hidden /> Revoke
      </Button>
      {status.kind === "error" ? (
        <span className="text-caption text-danger">{status.message}</span>
      ) : null}
    </div>
  );
}
