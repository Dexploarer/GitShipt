"use client";

import * as React from "react";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { FormField } from "@/components/shared/FormField";
import { FormError } from "@/components/shared/FormError";
import {
  ApiErrorResponseSchema,
  MfaVerifyResponseSchema,
} from "@repo/shared";

/**
 * Re-confirms MFA freshness for the next 5 minutes. Used immediately
 * before invoking a destructive Server Action.
 */
export function VerifyMfa() {
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirmedAt, setConfirmedAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const rawBody = await res.json().catch(() => null);
      if (!res.ok) {
        const body = ApiErrorResponseSchema.safeParse(rawBody);
        throw new Error(
          (body.success ? body.data.error : null) ??
            `verify failed: ${res.status}`,
        );
      }
      const body = MfaVerifyResponseSchema.parse(rawBody);
      setConfirmedAt(body.confirmedAt ?? new Date().toISOString());
      setToken("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      {error ? (
        <FormError message={error} onDismiss={() => setError(null)} />
      ) : null}
      <FormField
        label="Re-confirm with your authenticator"
        htmlFor="verify-mfa-token"
        required
      >
        <Input
          id="verify-mfa-token"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="text-mono-md"
        />
      </FormField>
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={busy || token.length !== 6}
        >
          {busy ? "Verifying…" : "Re-confirm"}
        </Button>
        {confirmedAt ? (
          <span className="text-body-sm text-success">
            Confirmed at <span className="text-mono-sm">{confirmedAt}</span>
          </span>
        ) : null}
      </div>
    </form>
  );
}
