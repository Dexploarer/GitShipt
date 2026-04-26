"use client";

import { useTransition, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@repo/ui";
import { retryPayout } from "../../actions";

export function RetryPayoutButton({
  projectId,
  payoutId,
}: {
  projectId: string;
  payoutId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        await retryPayout({
          projectId,
          payoutId,
          idempotencyKey: `retry-${payoutId}-${Date.now()}`,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Retry failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onClick}
        disabled={pending}
      >
        <RotateCcw className="size-3.5" />
        {pending ? "Retrying..." : "Retry"}
      </Button>
      {error ? (
        <span className="text-caption text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
