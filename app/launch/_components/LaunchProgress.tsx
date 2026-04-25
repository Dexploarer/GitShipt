"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LaunchPhase =
  | "idle"
  | "creating-draft"
  | "uploading-metadata"
  | "configuring-fee-share"
  | "submitting-tx"
  | "persisting"
  | "done";

const STEPS: { key: Exclude<LaunchPhase, "idle">; label: string }[] = [
  { key: "creating-draft", label: "Creating draft..." },
  { key: "uploading-metadata", label: "Uploading token metadata..." },
  { key: "configuring-fee-share", label: "Configuring fee share..." },
  { key: "submitting-tx", label: "Submitting launch transaction..." },
  { key: "persisting", label: "Persisting..." },
  { key: "done", label: "Done" },
];

export function LaunchProgress({ phase }: { phase: LaunchPhase }) {
  if (phase === "idle") return null;

  const currentIdx = STEPS.findIndex((s) => s.key === phase);
  const currentLabel = STEPS[currentIdx]?.label ?? "Working...";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={phase !== "done"}
      className="mt-6 rounded-lg border border-border bg-surface p-6"
    >
      <header className="mb-4 flex items-center gap-2">
        {phase === "done" ? (
          <span className="grid size-5 place-items-center rounded-full bg-success">
            <Check className="size-3 text-bg" />
          </span>
        ) : (
          <Loader2 className="size-4 animate-spin text-primary" />
        )}
        <span className="text-headline-sm">{currentLabel}</span>
      </header>

      <ol className="space-y-2">
        {STEPS.map((s, idx) => {
          const state =
            idx < currentIdx ? "done" : idx === currentIdx ? "current" : "pending";
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-center gap-3 text-body-sm",
                state === "done" && "text-fg-secondary",
                state === "current" && "text-fg",
                state === "pending" && "text-fg-muted",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-mono-sm",
                  state === "done" && "bg-success-soft text-success",
                  state === "current" && "bg-primary-soft text-primary",
                  state === "pending" && "border border-border text-fg-muted",
                )}
                aria-hidden
              >
                {state === "done" ? (
                  <Check className="size-3" />
                ) : state === "current" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <span className="size-1.5 rounded-full bg-fg-muted" />
                )}
              </span>
              <span className={state === "done" ? "line-through" : undefined}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
