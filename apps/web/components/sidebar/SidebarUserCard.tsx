"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronUp,
  LayoutDashboard,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { useSidebar } from "@repo/ui";
import { signOutAction } from "./sign-out-action";
import { cn } from "@repo/lib";

export interface SidebarUserCardProps {
  /** Stable authenticated user id. Used as a signed-in signal. */
  id?: string | null;
  /**
   * Display name fallback chain: `name` → `email` local-part → "Account".
   */
  name?: string | null;
  email?: string | null;
  /** GitHub handle without leading `@`. */
  username?: string | null;
  /** Profile image URL — typically the GitHub avatar. */
  imageUrl?: string | null;
}

/**
 * Signed-in user card for the sidebar footer.
 *
 * Layout:
 *
 *  ┌─────────────────────────────┐
 *  │ [avatar] Display Name    ⌄  │
 *  │           @gh-username      │
 *  └─────────────────────────────┘
 *
 * Click toggles a small popover (Profile / My dashboard / Settings /
 * Sign out). Hand-rolled dropdown matching the `TokenActionsMenu` pattern
 * — no Radix dep, click-outside + Escape close.
 *
 * When the desktop sidebar is collapsed (icon rail), the card collapses to
 * just the avatar; the popover still works. When no session identity is
 * present, renders nothing.
 */
export function SidebarUserCard({
  id,
  name,
  email,
  username,
  imageUrl,
}: SidebarUserCardProps) {
  const { collapsed } = useSidebar();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!id && !name && !email && !username && !imageUrl) return null;

  const displayName =
    name ?? username ?? (email ? email.split("@")[0] : null) ?? "Account";
  const handle = username ? `@${username}` : (email ?? null);
  const initial = (displayName.trim().charAt(0) || "?").toUpperCase();
  const profileHref = username ? `/u/${username}` : "/dashboard";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          collapsed
            ? `${displayName}${handle ? ` · ${handle}` : ""}`
            : undefined
        }
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-md",
          "border border-transparent",
          "px-2 py-1.5 text-left",
          "transition-colors",
          "hover:bg-surface-elevated/60 hover:border-border/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          open && "bg-surface-elevated border-border/50",
          collapsed && "lg:justify-center lg:px-0",
        )}
      >
        <Avatar imageUrl={imageUrl} initial={initial} alt={displayName} />
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col leading-tight",
            collapsed && "lg:hidden",
          )}
        >
          <span className="truncate text-label-sm text-fg">{displayName}</span>
          {handle ? (
            <span className="truncate text-caption text-fg-muted">
              {handle}
            </span>
          ) : null}
        </div>
        <ChevronUp
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-fg-muted transition-transform duration-200",
            open ? "rotate-0" : "rotate-180",
            collapsed && "lg:hidden",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute bottom-full left-0 right-0 z-30 mb-2",
            "min-w-[200px]",
            "rounded-lg border border-border-strong",
            "glass-strong shadow-popover",
            "py-1",
            // When collapsed (icon rail), pin the popover to the right of
            // the rail so it doesn't get clipped.
            collapsed &&
              "lg:left-full lg:right-auto lg:bottom-0 lg:ml-2 lg:mb-0",
          )}
        >
          <MenuLink
            href={profileHref}
            icon={UserIcon}
            label="Profile"
            onSelect={() => setOpen(false)}
          />
          <MenuLink
            href="/dashboard"
            icon={LayoutDashboard}
            label="My dashboard"
            onSelect={() => setOpen(false)}
          />
          <MenuLink
            href="/dashboard/wallets"
            icon={Settings}
            label="Settings"
            onSelect={() => setOpen(false)}
          />
          <Divider />
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left",
                "text-body-sm text-fg-secondary",
                "transition-colors hover:bg-surface-elevated hover:text-danger",
                "focus-visible:outline-none focus-visible:bg-surface-elevated focus-visible:text-danger",
              )}
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">Sign out</span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({
  imageUrl,
  initial,
  alt,
}: {
  imageUrl?: string | null;
  initial: string;
  alt: string;
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={alt}
        width={28}
        height={28}
        unoptimized
        className="size-7 shrink-0 rounded-md border border-border/50 object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-elevated text-label-sm text-fg-secondary"
    >
      {initial}
    </span>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onSelect,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5",
        "text-body-sm text-fg-secondary",
        "transition-colors hover:bg-surface-elevated hover:text-fg",
        "focus-visible:outline-none focus-visible:bg-surface-elevated focus-visible:text-fg",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border/60" aria-hidden />;
}
