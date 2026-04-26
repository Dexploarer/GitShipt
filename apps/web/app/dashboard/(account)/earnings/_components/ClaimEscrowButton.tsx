"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet, Loader2, Check } from "lucide-react";
import { Button } from "@repo/ui";
import { formatSol } from "@repo/lib";

type Phase = "idle" | "loading" | "success" | "error";

interface Props {
  projectId: string;
  projectSlug: string;
  escrowLamports: bigint;
  walletLinked: boolean;
}

/**
 * Per-project manual escrow drain trigger. Posts to `/api/claims/escrow`
 * with a `{ projectId }` filter so the user can settle one repo at a time.
 *
 * The button hides itself behind two pre-conditions:
 *   - wallet must be linked (otherwise renders disabled hint)
 *   - escrow balance > 0 (otherwise renders "Nothing to claim")
 *
 * On success it calls `router.refresh()` so the server `/dashboard/earnings`
 * page re-fetches the new (drained) totals.
 */
export function ClaimEscrowButton({
  projectId,
  projectSlug,
  escrowLamports,
  walletLinked,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);

  if (!walletLinked) {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled
        title="Link a wallet first"
      >
        <Wallet className="size-4" /> Link wallet to claim
      </Button>
    );
  }

  if (escrowLamports === 0n) {
    return (
      <Button variant="ghost" size="sm" disabled title="Nothing to claim">
        Nothing to claim
      </Button>
    );
  }

  async function onClick(): Promise<void> {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/claims/escrow", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `${projectId}:${Date.now()}`,
        },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(
          payload.message ?? payload.error ?? `Request failed (${res.status})`,
        );
      }
      setPhase("success");
      router.refresh();
      window.setTimeout(() => setPhase("idle"), 2_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return (
      <Button variant="primary" size="sm" disabled>
        <Loader2 className="size-4 animate-spin" /> Claiming…
      </Button>
    );
  }

  if (phase === "success") {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Check className="size-4" /> Queued
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        size="sm"
        onClick={onClick}
        title={`Drain escrow for ${projectSlug}`}
      >
        <Wallet className="size-4" /> Claim {formatSol(escrowLamports, 4)}
      </Button>
      {phase === "error" && error ? (
        <span className="text-label-sm text-danger">{error}</span>
      ) : null}
    </div>
  );
}
