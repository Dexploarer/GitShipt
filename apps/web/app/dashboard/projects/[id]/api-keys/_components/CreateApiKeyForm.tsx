"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@repo/ui";
import { Checkbox } from "@repo/ui";
import { Input } from "@repo/ui";
import { Card } from "@repo/ui";
import {
  PROJECT_API_KEY_SCOPE_DESCRIPTIONS,
  PROJECT_API_KEY_SCOPE_LABELS,
  PROJECT_API_KEY_SCOPES,
  type ProjectApiKeyScope,
} from "@repo/shared";
import { FormField } from "@/components/shared/FormField";
import { FormError } from "@/components/shared/FormError";

export interface CreateApiKeyFormProps {
  projectId: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "revealed";
      rawKey: string;
      keyName: string;
    };

/**
 * Inline create-key UI. Toggles open from the parent's "New API key" button,
 * submits to POST /api/projects/[id]/api-keys, then reveals the raw key
 * EXACTLY ONCE in a same-card success state with a copy button.
 *
 * Uses an `Idempotency-Key` header so accidental double-submits don't mint
 * two keys.
 */
export function CreateApiKeyForm({ projectId }: CreateApiKeyFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<ProjectApiKeyScope[]>([
    "read:project",
    "read:leaderboard",
    "read:payouts",
    "read:token",
  ]);
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const idemRef = React.useRef<string>(crypto.randomUUID());

  function reset() {
    setOpen(false);
    setName("");
    setScopes([
      "read:project",
      "read:leaderboard",
      "read:payouts",
      "read:token",
    ]);
    setPhase({ kind: "idle" });
    setError(null);
    setCopied(false);
    idemRef.current = crypto.randomUUID();
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind === "submitting") return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    if (scopes.length === 0) {
      setError("Select at least one scope.");
      return;
    }
    setError(null);
    setPhase({ kind: "submitting" });
    try {
      const res = await fetch(`/api/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idemRef.current,
        },
        body: JSON.stringify({ name: trimmed, scopes }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setPhase({ kind: "idle" });
        setError(
          body.message ?? body.error ?? `Request failed (${res.status}).`,
        );
        return;
      }
      const data = (await res.json()) as {
        rawKey: string;
        key: { name: string };
      };
      setPhase({
        kind: "revealed",
        rawKey: data.rawKey,
        keyName: data.key.name,
      });
    } catch (err) {
      setPhase({ kind: "idle" });
      setError((err as Error).message);
    }
  }

  async function copy() {
    if (phase.kind !== "revealed") return;
    try {
      await navigator.clipboard.writeText(phase.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // copy unavailable; user can select manually
    }
  }

  if (!open && phase.kind !== "revealed") {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <KeyRound className="size-4" aria-hidden />
        New API key
      </Button>
    );
  }

  if (phase.kind === "revealed") {
    return (
      <Card
        depth="flat"
        padding="none"
        className="border-success/40 bg-success-soft"
      >
        <div className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-label-lg text-fg">
              Key created · {phase.keyName}
            </h2>
            <p className="mt-0.5 text-body-sm text-fg-secondary">
              Save this now — it won&apos;t be shown again. We only store a
              hash; we cannot recover the raw key for you later.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2">
            <code className="flex-1 truncate text-mono-sm text-fg">
              {phase.rawKey}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={copy}
              aria-label="Copy API key to clipboard"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" aria-hidden /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden /> Copy
                </>
              )}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={reset}>
              Done
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card depth="flat" padding="none">
      <form className="flex flex-col gap-3 p-5" onSubmit={onSubmit} noValidate>
        <div>
          <h2 className="text-label-lg text-fg">New API key</h2>
          <p className="mt-0.5 text-body-sm text-fg-secondary">
            Give it a label and the narrowest scopes it needs.
          </p>
        </div>
        {error ? (
          <FormError message={error} onDismiss={() => setError(null)} />
        ) : null}
        <FormField
          label="Name"
          required
          hint="e.g. “Production webhook” or “CI dashboard”"
        >
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production webhook"
            maxLength={64}
            autoFocus
          />
        </FormField>
        <fieldset className="grid gap-2">
          <legend className="text-label-sm text-fg-secondary">Scopes</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROJECT_API_KEY_SCOPES.map((scope) => {
              const checked = scopes.includes(scope);
              return (
                <label
                  key={scope}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-surface-elevated/50 px-3 py-2"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => {
                      setScopes((current) =>
                        value
                          ? Array.from(new Set([...current, scope]))
                          : current.filter((item) => item !== scope),
                      );
                    }}
                    aria-label={PROJECT_API_KEY_SCOPE_LABELS[scope]}
                  />
                  <span className="min-w-0">
                    <span className="block text-label-sm text-fg">
                      {PROJECT_API_KEY_SCOPE_LABELS[scope]}
                    </span>
                    <span className="block text-caption text-fg-muted">
                      {PROJECT_API_KEY_SCOPE_DESCRIPTIONS[scope]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOpen(false);
              setName("");
              setScopes([
                "read:project",
                "read:leaderboard",
                "read:payouts",
                "read:token",
              ]);
              setError(null);
            }}
            disabled={phase.kind === "submitting"}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={phase.kind === "submitting"}
          >
            {phase.kind === "submitting" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
                Creating…
              </>
            ) : (
              "Create key"
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
