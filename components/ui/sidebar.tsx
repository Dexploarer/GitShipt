"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Sidebar primitive — shadcn-composable, macOS Tahoe / Liquid Glass aesthetic.
 *
 * Composition:
 *   <SidebarProvider>
 *     <Sidebar>
 *       <SidebarHeader>...</SidebarHeader>
 *       <SidebarContent>
 *         <SidebarSection title="Project">
 *           <SidebarItem icon={Home} href="/" label="Overview" />
 *         </SidebarSection>
 *       </SidebarContent>
 *       <SidebarFooter>...</SidebarFooter>
 *     </Sidebar>
 *     <main>{children}</main>
 *   </SidebarProvider>
 *
 * State: collapsed/expanded via React Context. Persisted to localStorage
 * under `gitbags:sidebar:collapsed`. Hydration-safe (only reads after mount).
 */

const STORAGE_KEY = "gitbags:sidebar:collapsed";

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used inside <SidebarProvider>");
  }
  return ctx;
}

export function SidebarProvider({
  defaultCollapsed = false,
  children,
}: {
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsedState] = React.useState(defaultCollapsed);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsedState(true);
    else if (stored === "0") setCollapsedState(false);
  }, []);

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      // localStorage may be unavailable in some browser contexts.
    }
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  const value = React.useMemo(
    () => ({ collapsed, toggle, setCollapsed }),
    [collapsed, toggle, setCollapsed],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

// ----------------------------------------------------------------------------
// Sidebar shell
// ----------------------------------------------------------------------------

export function Sidebar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const { collapsed } = useSidebar();
  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        // Designed to live inside an overflow:hidden viewport-locked shell.
        // Stretches to fill the parent's full height — internal regions
        // (header / scrollable nav / footer) handle their own overflow so
        // the nav can scroll independently of the page.
        "flex h-full flex-col shrink-0",
        "rounded-2xl",
        "glass shadow-floating surface-highlight",
        "border border-border/50",
        "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "overflow-hidden",
        collapsed ? "w-[68px]" : "w-[260px]",
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

// ----------------------------------------------------------------------------
// Header / Content / Footer regions
// ----------------------------------------------------------------------------

export function SidebarHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex h-14 items-center gap-2 px-3 shrink-0",
        "border-b border-border/40",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <nav
      className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden px-2 py-3",
        "[scrollbar-width:thin] [scrollbar-color:var(--border-strong)_transparent]",
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

export function SidebarFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { collapsed } = useSidebar();
  return (
    <div
      className={cn(
        "shrink-0 border-t border-border/40 bg-bg/30",
        collapsed ? "px-2 py-2" : "px-3 py-3",
        "space-y-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sections + items
// ----------------------------------------------------------------------------

export function SidebarSection({
  title,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  const { collapsed } = useSidebar();
  return (
    <div className={cn("py-1.5", className)} {...props}>
      {title && !collapsed ? (
        <div className="px-2.5 pb-1.5 text-caption uppercase tracking-wider text-fg-muted">
          {title}
        </div>
      ) : null}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href?: string;
  active?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Keep the item rendered when collapsed (default: true). Useful to hide admin-only items. */
  show?: boolean;
}

export function SidebarItem({
  icon: Icon,
  label,
  href,
  active,
  badge,
  onClick,
  disabled,
  show = true,
}: SidebarItemProps) {
  const { collapsed } = useSidebar();
  if (!show) return null;

  const inner = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span
        className={cn(
          "truncate text-label-md",
          collapsed && "sr-only",
        )}
      >
        {label}
      </span>
      {badge && !collapsed ? (
        <span className="ml-auto shrink-0">{badge}</span>
      ) : null}
    </>
  );

  const className = cn(
    "group flex h-9 items-center gap-3 rounded-md px-2.5",
    "transition-[background-color,color,box-shadow] duration-150",
    active
      ? "bg-surface-elevated text-fg shadow-inset-light"
      : "text-fg-secondary hover:bg-surface-elevated/60 hover:text-fg",
    disabled && "pointer-events-none opacity-40",
    collapsed && "justify-center px-0",
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className} title={collapsed ? label : undefined}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(className, "w-full text-left")}
      title={collapsed ? label : undefined}
    >
      {inner}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Collapse toggle
// ----------------------------------------------------------------------------

export function SidebarToggle({ className }: { className?: string }) {
  const { collapsed, toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md",
        "text-fg-secondary hover:bg-surface-elevated hover:text-fg",
        "transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
    >
      {collapsed ? (
        <ChevronRight className="size-4" />
      ) : (
        <ChevronLeft className="size-4" />
      )}
    </button>
  );
}

/**
 * Convenience: a horizontal divider that respects the sidebar's hairline style.
 */
export function SidebarDivider({ className }: { className?: string }) {
  return <div className={cn("my-2 h-px bg-border/40", className)} />;
}
