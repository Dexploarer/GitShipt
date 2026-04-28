"use client";

import * as React from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@repo/ui";
import { Card } from "@repo/ui";
import { cn } from "@repo/lib";

/**
 * Generic destructive-confirmation modal.
 *
 * Per PRD § "Critical action gates":
 *  - Reason textarea (min 20 chars, validated client-side AND server-side).
 *  - Type-the-target-name confirmation.
 *  - MFA reverify against POST /api/auth/mfa/verify. The server action then
 *    reads the Redis-backed MFA confirmation; client timestamps are telemetry.
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
    idempotencyKey: string;
  }) => Promise<void>;
}

const REASON_MIN = 20;
const MFA_CODE_RE = /^\d{6}$/;

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

  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (open) return;

    const raf = requestAnimationFrame(() => {
      setReason("");
      setTyped("");
      setMfa("");
      setError(null);
      setBusy(false);
    });

    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Focus management: trap Tab inside the dialog, close on Escape, restore
  // focus to whatever was focused before the dialog opened.
  React.useEffect(() => {
    if (!open) return;

    // Stash the element that owned focus when we opened, so we can restore.
    previouslyFocusedRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    // Move focus into the dialog on next paint (after the node mounts).
    const focusFirst = () => {
      const node = dialogRef.current;
      if (!node) return;
      const focusables = getFocusableElements(node);
      const target = focusables[0] ?? node;
      target.focus();
    };
    // rAF so the dialog is painted before we attempt to focus its contents.
    const raf = requestAnimationFrame(focusFirst);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusables = getFocusableElements(node);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      // Shift+Tab from first → wrap to last; Tab from last → wrap to first.
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !node.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the previously-focused element on close/unmount.
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const reasonOk = reason.trim().length >= REASON_MIN;
  const typedOk = typed === targetName;
  const mfaOk = MFA_CODE_RE.test(mfa);
  const canSubmit = reasonOk && typedOk && mfaOk && !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const mfaConfirmedAtMs = await verifyMfa(mfa);
      await action({
        reason: reason.trim(),
        typedConfirmation: typed,
        mfaConfirmedAtMs,
        idempotencyKey: newClientIdempotencyKey("destructive"),
      });
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
      onMouseDown={(e) => {
        // Backdrop click closes; clicks inside the Card don't reach here
        // because the inner content stops propagation via its own DOM nesting.
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <Card
        ref={dialogRef}
        depth="floating"
        glass="glass"
        padding="default"
        className="w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="destructive-confirm-title"
        tabIndex={-1}
      >
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-danger-soft text-danger">
              <AlertTriangle className="size-4" />
            </span>
            <div>
              <h3 id="destructive-confirm-title" className="text-headline-sm">
                {title}
              </h3>
              <p className="mt-1 text-body-sm text-fg-secondary">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="gb-control gb-control-icon gb-control-ghost inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:text-fg"
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
            hint={<span className="text-mono-sm">{targetName}</span>}
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
            label="MFA code"
            hint={
              <span className="text-caption text-fg-muted">6-digit TOTP</span>
            }
            error={!mfaOk && mfa.length > 0 ? "Enter 6 digits" : null}
          >
            <input
              value={mfa}
              onChange={(e) =>
                setMfa(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              pattern="\d{6}"
              required
              className={cn(
                "w-full rounded-md border border-border bg-surface-elevated px-3 py-2",
                "text-mono-sm text-fg placeholder:text-fg-muted",
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

function newClientIdempotencyKey(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function verifyMfa(token: string): Promise<number | undefined> {
  const idempotencyKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mfa-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const res = await fetch("/api/auth/mfa/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ token }),
  });

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(readMfaError(body, res.status));
  }

  if (
    body &&
    typeof body === "object" &&
    "confirmedAt" in body &&
    typeof body.confirmedAt === "string"
  ) {
    const ts = Date.parse(body.confirmedAt);
    return Number.isFinite(ts) ? ts : undefined;
  }

  return undefined;
}

function readMfaError(body: unknown, status: number): string {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return `MFA verification failed (${status}).`;
  }

  switch (body.error) {
    case "not_enrolled":
      return "MFA is not enrolled for this account. Enroll MFA before using destructive admin actions.";
    case "invalid_token":
      return "MFA code is invalid or expired.";
    case "rate_limited":
      return "Too many MFA attempts. Wait a moment, then try again.";
    case "db_unavailable":
      return "MFA verification needs the database connection.";
    default:
      return `MFA verification failed: ${String(body.error)}.`;
  }
}

/** Selectors for elements that can receive keyboard focus. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute("inert") && el.offsetParent !== null);
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
        {hint ? (
          <span className="text-caption text-fg-muted">{hint}</span>
        ) : null}
      </span>
      {children}
      {error ? <span className="text-caption text-danger">{error}</span> : null}
    </label>
  );
}
