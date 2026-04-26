"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        confirmedAt?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `verify failed: ${res.status}`);
      }
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
      <label className="flex flex-col gap-1">
        <span className="text-label-sm text-fg-secondary">
          Re-confirm with your authenticator
        </span>
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="text-mono-md"
        />
      </label>
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
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </form>
  );
}
