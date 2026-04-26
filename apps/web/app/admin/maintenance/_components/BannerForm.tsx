"use client";

import * as React from "react";
import { Button } from "@repo/ui";
import { FormField } from "@/components/shared/FormField";
import { FormError } from "@/components/shared/FormError";
import { updateBanner } from "@/app/admin/actions";

export function BannerForm({
  initialMessage,
  initialVisible,
}: {
  initialMessage: string;
  initialVisible: boolean;
}) {
  const [message, setMessage] = React.useState(initialMessage);
  const [visible, setVisible] = React.useState(initialVisible);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await updateBanner({ message, visible });
      setSavedAt(Date.now());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {err ? (
        <FormError message={err} onDismiss={() => setErr(null)} />
      ) : null}

      <FormField
        label="Message"
        htmlFor="banner-message"
        hint={`${message.length} / 500`}
      >
        <textarea
          id="banner-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          rows={3}
          className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-body-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Scheduled maintenance Sat 04:00 UTC. Payouts pause for ~10 min."
        />
      </FormField>

      <label className="flex items-center gap-2 text-body-sm text-fg-secondary">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
          className="size-4 accent-primary"
        />
        Show banner publicly
      </label>

      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-fg-muted">
          {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : "—"}
        </span>
        <Button variant="primary" size="sm" disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save banner"}
        </Button>
      </div>
    </div>
  );
}
