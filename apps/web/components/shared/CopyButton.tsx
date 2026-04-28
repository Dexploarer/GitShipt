"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@repo/lib";

/**
 * Tiny client island used wherever we surface a value the user might want
 * to copy (contract address, payout signature, snapshot Merkle root, etc.).
 * Keeps the host server component hydration-light — only this island ships JS.
 */
export function CopyButton({
  value,
  className,
  label = "Copy to clipboard",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // navigator.clipboard not available (insecure context, old browser).
      // Fall through silently — UI never confirmed, user can long-press.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied!" : label}
      className={cn(
        "gb-control gb-control-icon gb-control-ghost inline-flex size-7 items-center justify-center rounded-md",
        "text-fg-muted hover:text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
