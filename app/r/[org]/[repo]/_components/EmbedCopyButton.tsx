"use client";

import { Check, Code2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * "Copy embed code" button. Generates a self-contained <iframe> snippet
 * that points at /embed/r/{org}/{repo} on the same origin and copies it
 * to the clipboard. Source of truth for the iframe dimensions lives here
 * so widget consumers get a sensible default; they can resize freely.
 */
export function EmbedCopyButton({
  ghOwner,
  ghRepo,
  className,
}: {
  ghOwner: string;
  ghRepo: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://gitbags.xyz";
    const src = `${origin}/embed/r/${ghOwner}/${ghRepo}`;
    const snippet = `<iframe src="${src}" width="380" height="360" style="border:0;border-radius:12px;color-scheme:light dark" loading="lazy" title="GitBags · ${ghOwner}/${ghRepo}"></iframe>`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silent fail.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Embed code copied" : "Copy embed code"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/60",
        "px-2.5 py-1 text-label-sm text-fg-secondary",
        "transition-colors hover:bg-surface-elevated hover:text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Code2 className="size-3.5" />
      )}
      {copied ? "Copied!" : "Embed"}
    </button>
  );
}
