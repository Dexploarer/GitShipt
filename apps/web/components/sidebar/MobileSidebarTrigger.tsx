"use client";

import { Menu, X } from "lucide-react";
import { useSidebar } from "@repo/ui";
import { cn } from "@repo/lib";

/**
 * Mobile-only hamburger button that toggles the sidebar drawer.
 *
 * Renders a small floating glass square anchored to the top-left of the
 * content area. On `lg+` (desktop) the inline sidebar takes over and this
 * trigger is hidden.
 *
 * Must live inside a `<SidebarProvider>` (the app shells already wrap their
 * children in one). Place it at the top of `<main>` so it's always reachable.
 */
export function MobileSidebarTrigger({ className }: { className?: string }) {
  const { mobileOpen, toggleMobile } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleMobile}
      aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
      aria-expanded={mobileOpen}
      className={cn(
        "lg:hidden",
        "inline-flex size-9 items-center justify-center rounded-md",
        "border border-border/60",
        "glass surface-highlight shadow-card-elevated",
        "text-fg-secondary hover:text-fg hover:bg-surface-elevated/60",
        "transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
    >
      {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
    </button>
  );
}
