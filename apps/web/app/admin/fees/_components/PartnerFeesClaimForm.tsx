"use client";

import * as React from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@repo/ui";
import { DestructiveConfirmModal } from "@/components/admin/DestructiveConfirmModal";
import { claimPartnerFees } from "@/app/admin/actions";
import { isPendingAdminApproval } from "@/lib/admin-action-result";

interface PartnerFeesClaimFormProps {
  partnerWallet: string;
  partnerConfigSet: boolean;
  stats: { claimedFees: string; unclaimedFees: string } | null;
  statsError: string | null;
  serverClaimAvailable: boolean;
  unavailableReason: string | null;
}

function formatLamportsAsSol(lamports: string): string {
  const value = BigInt(lamports);
  const whole = value / 1_000_000_000n;
  const fractional = (value % 1_000_000_000n)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  return `${whole.toString()}.${fractional || "0"} SOL`;
}

export function PartnerFeesClaimForm({
  partnerWallet,
  partnerConfigSet,
  stats,
  statsError,
  serverClaimAvailable,
  unavailableReason,
}: PartnerFeesClaimFormProps) {
  const [open, setOpen] = React.useState(false);
  const [lastClaim, setLastClaim] = React.useState<{
    signatures: string[];
    afterUnclaimedFees: string;
  } | null>(null);
  const unclaimedFees = stats ? BigInt(stats.unclaimedFees) : 0n;
  const canClaim =
    partnerConfigSet &&
    serverClaimAvailable &&
    unclaimedFees > 0n &&
    !statsError;

  return (
    <div className="mt-4 rounded-md border border-border/60 bg-surface-elevated/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-label-md text-fg">Partner fee claims</p>
          <div className="grid gap-1 text-body-sm text-fg-secondary">
            <span>
              Claimed{" "}
              <span className="text-mono-sm text-fg">
                {stats ? formatLamportsAsSol(stats.claimedFees) : "unknown"}
              </span>
            </span>
            <span>
              Unclaimed{" "}
              <span className="text-mono-sm text-fg">
                {stats ? formatLamportsAsSol(stats.unclaimedFees) : "unknown"}
              </span>
            </span>
          </div>
          {statsError ? (
            <p className="text-caption text-danger">{statsError}</p>
          ) : null}
          {!canClaim && unavailableReason ? (
            <p className="max-w-xl text-caption text-fg-muted">
              {unavailableReason}
            </p>
          ) : null}
          {lastClaim ? (
            <p className="text-caption text-success">
              Claimed with{" "}
              <span className="text-mono-sm">
                {lastClaim.signatures.length}
              </span>{" "}
              transaction(s); unclaimed now{" "}
              <span className="text-mono-sm">
                {formatLamportsAsSol(lastClaim.afterUnclaimedFees)}
              </span>
              .
            </p>
          ) : null}
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={!canClaim}
          onClick={() => setOpen(true)}
        >
          <HandCoins className="size-4" /> Claim fees
        </Button>
      </div>

      <DestructiveConfirmModal
        open={open}
        onOpenChange={setOpen}
        title="Claim partner fees"
        description={
          <>
            Claims available Bags partner fees for{" "}
            <span className="text-mono-sm">{partnerWallet}</span>.
          </>
        }
        targetName="partner.fees.claim"
        targetLabel="Type partner.fees.claim to confirm"
        confirmLabel="Claim fees"
        busyLabel="Claiming..."
        cosignRequired
        action={async (p) => {
          const result = await claimPartnerFees({ partnerWallet, ...p });
          if (isPendingAdminApproval(result)) return result;
          setLastClaim({
            signatures: result.signatures,
            afterUnclaimedFees: result.after.unclaimedFees,
          });
          return result;
        }}
        successToast="Partner fees claim broadcast"
      />
    </div>
  );
}
