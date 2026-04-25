"use client";

import * as React from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Generic destructive-confirmation modal.
 *
 * Per PRD § "Critical action gates":
 *  - Reason textarea (min 20 chars, validated client-side AND server-side).
 *  - Type-the-target-name confirmation.
 *  - MFA reverify stub (for v0 we collect a 6-digit TOTP code optionally and
 *    pass `mfaConfirmedAtMs = Date.now()` when the user has typed it; v1.1
 *    will validate the code against the user's encrypted secret).
 *
 * Caller passes an `action` async function that should call the relevant
 * Server Action with the validated payload.
 */

export interface DestructiveConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** The exact string the operator must type to confirm. */
  targetName: string;
  /** Visible label of the confirmation field. */
  targetLabel?: string;
  confirmLabel?: string;
  busyLabel?: string;
  /**
   * Async action called when the form is submitted with valid input. Must
   * throw on failure. The caller is responsible for invoking the right
   * Server Action.
   */
  action: (payload: {
    reason: string;
    typedConfirmation: string;
    mfaConfirmedAtMs: number | undefined;
  }) => Promise<void>;
}

const REASON_MIN = 20;

export function DestructiveConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  targetName,
  targetLabel = "Type the target name to confirm",
  confirmLabel = "Confirm",
  busyLabel = "Working...",
  action,
}: DestructiveConfirmModalProps) {
  const [reason, setReason] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [mfa, setMfa] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setReason("");
      setTyped("");
      setMfa("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const reasonOk = reason.trim().length >= REASON_MIN;
  const typedOk = typed === targetName;
  const canSubmit = reasonOk && typedOk && !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      // v0 MFA stub: when the operator types any 6-digit code we treat MFA as
      // freshly confirmed. v1.1 will validate the TOTP server-side.
      const mfaConfirmedAtMs = /^\d{6}$/.test(mfa) ? Date.now() : undefined;
      await action({ reason: reason.trim(), typedConfirmation: typed, mfaConfirmedAtMs });
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-bg/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="destructive-confirm-title"
    >
      <Card
        depth="floating"
        glass="glass"
        padding="default"
        className="w-full max-w-md"
      >
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-danger-soft text-danger">
              <AlertTriangle className="size-4" />
            </span>
            <div>
              <h3
                id="destructive-confirm-title"
                className="text-headline-sm tracking-tight"
              >
                {title}
              </h3>
              <p className="mt-1 text-body-sm text-fg-secondary">{description}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="text-fg-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field
            label={`Reason (min ${REASON_MIN} chars)`}
            hint={`${reason.trim().length} / ${REASON_MIN}`}
            error={!reasonOk && reason.length > 0 ? "Too short" : null}
          >
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className={cn(
                "w-full resize-none rounded-md border border-border bg-surface-elevated px-3 py-2",
                "text-body-sm text-fg placeholder:text-fg-muted",
                "focus:outline-none focus:ring-2 focus:ring-primary",
              )}
              placeholder="Why is this action necessary? Tickets, links, context."
              required
            />
          </Field>

          <Field
            label={targetLabel}
            hint={
              <span className="text-mono-sm">{targetName}</span>
            }
            error={!typedOk && typed.length > 0 ? "Mismatch" : null}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={cn(
                "w-full rounded-md border border-border bg-surface-elevated px-3 py-2",
                "text-mono-sm text-fg placeholder:text-fg-muted",
                "focus:outline-none focus:ring-2 focus:ring-primary",
              )}
              placeholder={targetName}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            label="MFA code (optional, v1.1 will require)"
            hint={<span className="text-caption text-fg-muted">6-digit TOTP</span>}
          >
            <input
              value={mfa}
              onChange={(e) => setMfa(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              pattern="\d{6}"
              className={cn(
                "w-full rounded-md border border-border bg-surface-elevated px-3 py-2",
                "text-mono-sm tracking-widest text-fg placeholder:text-fg-muted",
                "focus:outline-none focus:ring-2 focus:ring-primary",
              )}
              placeholder="000000"
              autoComplete="off"
            />
          </Field>

          {error ? (
            <p className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-body-sm text-danger">
              {error}
            </p>
          ) : null}

          <footer className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={!canSubmit}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {busyLabel}
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </footer>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-label-sm text-fg-secondary">
        <span>{label}</span>
        {hint ? <span className="text-caption text-fg-muted">{hint}</span> : null}
      </span>
      {children}
      {error ? <span className="text-caption text-danger">{error}</span> : null}
    </label>
  );
}
