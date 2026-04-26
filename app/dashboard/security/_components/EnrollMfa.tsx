"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EnrollResponse = { qrDataUrl: string; secretBase32: string };

/**
 * Enrollment flow:
 *   1. POST /api/auth/mfa/enroll -> server creates secret, returns QR.
 *   2. User scans + enters their first code.
 *   3. POST /api/auth/mfa/verify -> server confirms + records freshness.
 *   4. Page reloads to show the enrolled state.
 */
export function EnrollMfa() {
  const [data, setData] = React.useState<EnrollResponse | null>(null);
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function startEnrollment() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `enroll failed: ${res.status}`);
      }
      setData((await res.json()) as EnrollResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmFirstCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `verify failed: ${res.status}`);
      }
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-fg-secondary">
          Click below to generate a fresh secret and a QR code you can scan
          with any authenticator app.
        </p>
        <div>
          <Button
            type="button"
            variant="primary"
            onClick={startEnrollment}
            disabled={busy}
          >
            {busy ? "Generating…" : "Set up authenticator"}
          </Button>
        </div>
        {error ? (
          <p className="text-body-sm text-danger">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.qrDataUrl}
          alt="MFA QR code"
          width={192}
          height={192}
          className="rounded"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-label-sm uppercase tracking-wide text-fg-muted">
            Manual entry
          </span>
          <code className="text-mono-sm break-all text-fg">
            {data.secretBase32}
          </code>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-label-sm text-fg-secondary">
            Enter the 6-digit code from your app
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
        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={confirmFirstCode}
            disabled={busy || token.length !== 6}
          >
            {busy ? "Confirming…" : "Confirm code"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setData(null);
              setToken("");
              setError(null);
            }}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
        {error ? (
          <p className="text-body-sm text-danger">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
