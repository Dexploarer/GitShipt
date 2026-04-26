"use client";

import * as React from "react";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { FormField } from "@/components/shared/FormField";
import { FormError } from "@/components/shared/FormError";
import { ApiErrorResponseSchema } from "@repo/shared";

/**
 * Disables MFA. Requires a valid current code so a stolen session cookie
 * alone cannot strip the second factor.
 */
export function RevokeMfa() {
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [arming, setArming] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = ApiErrorResponseSchema.safeParse(
          await res.json().catch(() => null),
        );
        throw new Error(
          (body.success ? body.data.error : null) ??
            `revoke failed: ${res.status}`,
        );
      }
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!arming) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-label-md text-fg">Disable MFA</h3>
        <p className="text-body-sm text-fg-secondary">
          Removes the authenticator from your account. You&apos;ll need to
          re-enroll before any destructive admin action will be allowed.
        </p>
        <div>
          <Button
            type="button"
            variant="danger"
            onClick={() => setArming(true)}
          >
            Disable MFA…
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <h3 className="text-label-md text-fg">Disable MFA</h3>
      {error ? (
        <FormError message={error} onDismiss={() => setError(null)} />
      ) : null}
      <FormField
        label="Confirm with your current 6-digit code"
        htmlFor="revoke-mfa-token"
        required
      >
        <Input
          id="revoke-mfa-token"
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
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="danger"
          disabled={busy || token.length !== 6}
        >
          {busy ? "Disabling…" : "Confirm disable"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setArming(false);
            setToken("");
            setError(null);
          }}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
