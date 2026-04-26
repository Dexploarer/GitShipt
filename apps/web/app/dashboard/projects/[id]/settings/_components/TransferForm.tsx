"use client";

import * as React from "react";
import { ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { cn } from "@repo/lib";

const REASON_MIN = 20;

interface TransferFormProps {
  projectId: string;
  /** `${ghOwner}/${ghRepo}`. Used to render the typed-confirmation prompt. */
  slug?: string;
}

interface SuccessResponse {
  ok: true;
  transferredTo: { id: string; name: string; email: string };
}

interface ErrorResponse {
  error: string;
  message?: string;
}

/**
 * Owner-side ownership-transfer form.
 *
 *   - Recipient lookup: email or GitHub username (server resolves; ambiguous
 *     matches reject).
 *   - Reason field — min 20 characters; logged with the audit entry.
 *   - Typed-confirmation: must equal `transfer ${slug}` exactly.
 *   - Optional MFA TOTP — when present, surfaces a fresh confirmation
 *     timestamp that the server checks against Redis.
 *
 * POSTs to `/api/projects/${projectId}/transfer` with an `Idempotency-Key`
 * header. The route is wrapped in `destructiveAction()` so the same checks
 * are enforced server-side.
 */
export function TransferForm({ projectId, slug }: TransferFormProps) {
  const expectedConfirmation = slug ? `transfer ${slug}` : "";

  const [recipient, setRecipient] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [mfa, setMfa] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<
    SuccessResponse["transferredTo"] | null
  >(null);

  const recipientOk = recipient.trim().length > 0;
  const reasonOk = reason.trim().length >= REASON_MIN;
  const confirmOk =
    expectedConfirmation.length > 0 && confirm === expectedConfirmation;
  const canSubmit = recipientOk && reasonOk && confirmOk && !busy;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    // v0 MFA stub: any 6-digit code surfaces a fresh confirmation timestamp.
    // Real TOTP validation lives in `lib/auth/mfa.ts` (v1.1).
    const mfaConfirmedAtMs = /^\d{6}$/.test(mfa) ? Date.now() : undefined;

    const idempotencyKey = `transfer:${projectId}:${recipient.trim()}:${Date.now()}`;

    try {
      const res = await fetch(`/api/projects/${projectId}/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          recipientLookup: recipient.trim(),
          reason: reason.trim(),
          confirm,
          mfaConfirmedAtMs,
        }),
      });
      const json = (await res.json()) as SuccessResponse | ErrorResponse;
      if (!res.ok || !("ok" in json)) {
        const err = json as ErrorResponse;
        setError(err.message ?? err.error ?? "Transfer failed.");
        setBusy(false);
        return;
      }
      setSuccess(json.transferredTo);
      setRecipient("");
      setReason("");
      setConfirm("");
      setMfa("");
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-body-sm text-danger">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          Ownership transfer is irreversible from this UI. The new owner gains
          full control; you are demoted to project moderator.
        </p>
      </div>

      <Field
        label="Recipient (email or GitHub username)"
        hint="Must already have signed in to GitBags at least once."
      >
        <Input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          maxLength={254}
          placeholder="octocat or new-owner@example.com"
          autoComplete="off"
          className="max-w-md"
        />
      </Field>

      <Field
        label={`Reason (min ${REASON_MIN} chars)`}
        hint={
          <span
            className={cn(
              "text-mono-sm",
              reasonOk ? "text-success" : "text-fg-muted",
            )}
          >
            {reason.trim().length} / {REASON_MIN}
          </span>
        }
        error={
          !reasonOk && reason.length > 0
            ? "Too short — give context for the audit log."
            : null
        }
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          className={cn(
            "w-full max-w-md resize-none rounded-md border border-border-strong bg-surface px-3 py-2",
            "text-body-md text-fg placeholder:text-fg-muted",
            "focus:outline-none focus:border-primary focus:shadow-inset-light",
          )}
          placeholder="Why are you handing this project off? Tickets, agreements, links."
        />
      </Field>

      <Field
        label="Type to confirm"
        hint={
          expectedConfirmation ? (
            <span className="text-mono-sm text-fg-secondary">
              {expectedConfirmation}
            </span>
          ) : null
        }
        error={!confirmOk && confirm.length > 0 ? "Does not match." : null}
      >
        <Input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={expectedConfirmation || "transfer owner/repo"}
          autoComplete="off"
          className="max-w-md text-mono-sm"
          disabled={!expectedConfirmation}
        />
      </Field>

      <Field
        label="MFA code (optional in v0; required v1.1)"
        hint={<span className="text-mono-sm text-fg-muted">6-digit TOTP</span>}
      >
        <Input
          type="text"
          value={mfa}
          onChange={(e) =>
            setMfa(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode="numeric"
          pattern="\d{6}"
          placeholder="000000"
          autoComplete="off"
          className="max-w-[8rem] text-mono-md tracking-widest"
        />
      </Field>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-body-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          role="status"
          className="rounded-md border border-success/40 bg-success-soft px-3 py-2 text-body-sm text-success"
        >
          Ownership transferred to{" "}
          <span className="text-mono-sm">{success.email}</span>.
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="danger" disabled={!canSubmit}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Transferring...
            </>
          ) : (
            <>
              <ArrowRight className="size-4" />
              Transfer ownership
            </>
          )}
        </Button>
        {!expectedConfirmation ? (
          <span className="text-caption text-fg-muted">
            Project slug unavailable — reload to enable.
          </span>
        ) : null}
      </div>
    </form>
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
      <span className="flex items-center justify-between gap-3 text-label-sm text-fg-secondary">
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
