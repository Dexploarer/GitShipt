"use client";

import { Github } from "@repo/ui";
import { useEffect, useRef, useState } from "react";
import {
  Check, ChevronDown, Code2, Copy, ExternalLink } from "lucide-react";
import { cn } from "@repo/lib";

/**
 * Token actions menu — dropdown trigger living in the TokenStatsRow header.
 *
 * Items:
 *  - Embed   → copies an <iframe> snippet pointing at /embed/r/{org}/{repo}
 *  - Copy CA → copies the token's contract address (disabled when no token)
 *  - GitHub  → opens the project's GitHub repo in a new tab
 *
 * Hand-rolled dropdown (no Radix dep). Closes on click-outside, Escape, or
 * after a successful copy. A momentary "Copied!" affordance flips the icon
 * to a green check for 1.5s without closing the menu.
 */
export function TokenActionsMenu({
  tokenMint,
  ghOwner,
  ghRepo,
  className,
}: {
  tokenMint: string | null;
  ghOwner: string;
  ghRepo: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"embed" | "ca" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside + ESC handlers, attached only when open.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copyEmbed() {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://gitshipt.com";
    const src = `${origin}/embed/r/${ghOwner}/${ghRepo}`;
    const snippet = `<iframe src="${src}" width="380" height="360" style="border:0;border-radius:12px;color-scheme:light dark" loading="lazy" title="GitShipt · ${ghOwner}/${ghRepo}"></iframe>`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied("embed");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function copyCA() {
    if (!tokenMint) return;
    try {
      await navigator.clipboard.writeText(tokenMint);
      setCopied("ca");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "gb-control inline-flex items-center gap-1.5 rounded-md border",
          "px-2.5 py-1 text-label-sm text-fg-secondary",
          "transition-[background-color,border-color,box-shadow,color,transform] hover:text-fg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          open
            ? "gb-control-secondary border-border-strong bg-surface-elevated text-fg"
            : "gb-control-ghost border-border/60",
        )}
      >
        Share
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-30 mt-1.5 min-w-[180px]",
            "rounded-lg border border-border-strong",
            "glass-strong shadow-popover",
            "py-1",
          )}
        >
          <MenuItem
            icon={copied === "embed" ? Check : Code2}
            iconClassName={copied === "embed" ? "text-success" : undefined}
            label={copied === "embed" ? "Copied!" : "Embed"}
            hint="iframe snippet"
            onClick={copyEmbed}
          />
          <MenuItem
            icon={copied === "ca" ? Check : Copy}
            iconClassName={copied === "ca" ? "text-success" : undefined}
            label={
              copied === "ca"
                ? "Copied!"
                : tokenMint
                  ? "Copy CA"
                  : "Copy CA · no token"
            }
            hint={tokenMint ? "contract address" : undefined}
            disabled={!tokenMint}
            onClick={copyCA}
          />
          <Divider />
          <MenuItem
            as="a"
            href={`https://github.com/${ghOwner}/${ghRepo}`}
            target="_blank"
            rel="noreferrer noopener"
            icon={Github}
            label="GitHub"
            hint={`${ghOwner}/${ghRepo}`}
            trailingIcon={ExternalLink}
            onClick={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

type IconType = typeof Code2;

interface MenuItemProps {
  icon: IconType;
  iconClassName?: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick?: () => void;
  trailingIcon?: IconType;
  as?: "button" | "a";
  href?: string;
  target?: string;
  rel?: string;
}

function MenuItem({
  icon: Icon,
  iconClassName,
  label,
  hint,
  disabled,
  onClick,
  trailingIcon: TrailingIcon,
  as = "button",
  href,
  target,
  rel,
}: MenuItemProps) {
  const className = cn(
    "gb-menu-item flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left",
    "text-body-sm text-fg-secondary",
    "transition-[background-color,box-shadow,color] hover:bg-surface-elevated hover:text-fg",
    "focus-visible:outline-none focus-visible:bg-surface-elevated focus-visible:text-fg",
    disabled && "pointer-events-none opacity-40",
  );

  const inner = (
    <>
      <Icon className={cn("size-4 shrink-0", iconClassName)} />
      <span className="flex-1 truncate">{label}</span>
      {hint ? (
        <span className="shrink-0 text-caption text-fg-muted">{hint}</span>
      ) : null}
      {TrailingIcon ? (
        <TrailingIcon className="size-3 shrink-0 text-fg-muted" />
      ) : null}
    </>
  );

  if (as === "a" && href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        role="menuitem"
        onClick={onClick}
        className={className}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {inner}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border/60" aria-hidden />;
}
