"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@repo/ui";

export function StartIncorporationButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/incorporation/start`,
          {
            method: "POST",
            headers: {
              "Idempotency-Key": `incorporation:start:${projectId}`,
            },
          },
        );
        const payload = (await res.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        if (!res.ok) {
          throw new Error(
            payload?.message ??
              payload?.error ??
              `Request failed (${res.status})`,
          );
        }
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Incorporation start failed.",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        onClick={start}
        disabled={disabled || pending}
      >
        <Building2 className="size-4" />
        {pending ? "Starting..." : "Start Bags incorporation"}
      </Button>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
