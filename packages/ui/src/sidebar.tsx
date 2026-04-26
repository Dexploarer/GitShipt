"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@repo/lib";

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
 * State:
 *  - `collapsed` — desktop (lg+) collapse to a 68px icon rail. Persisted to
 *    localStorage["gitbags:sidebar:collapsed"] after mount.
 *  - `mobileOpen` — controls the slide-over drawer on small (< lg) viewports.
 *    Defaults to false; opened by `<MobileSidebarTrigger>` outside the sidebar
 *    (rendered in each app shell). Closes on backdrop click, Escape, or any
 *    `<SidebarItem>` click (so navigating dismisses the drawer).
 */

const STORAGE_KEY = "gitbags:sidebar:collapsed";
const SIDEBAR_COLLAPSED_COOKIE = "gitbags_sidebar_collapsed";

function persistCollapsedPreference(v: boolean) {
  const value = v ? "1" : "0";
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage may be unavailable in some browser contexts.
  }
  try {
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Cookies may be unavailable in some embedded/browser contexts.
  }
}

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
  // Mobile drawer
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  closeMobile: () => void;
  toggleMobile: () => void;
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
  const [mobileOpen, setMobileOpenState] = React.useState(false);

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v);
    persistCollapsedPreference(v);
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      persistCollapsedPreference(next);
      return next;
    });
  }, []);

  const setMobileOpen = React.useCallback((v: boolean) => {
    setMobileOpenState(v);
  }, []);

  const closeMobile = React.useCallback(() => {
    setMobileOpenState(false);
  }, []);

  const toggleMobile = React.useCallback(() => {
    setMobileOpenState((v) => !v);
  }, []);

  // Lock body scroll when the mobile drawer is open + close on Escape.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpenState(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const value = React.useMemo(
    () => ({
      collapsed,
      toggle,
      setCollapsed,
      mobileOpen,
      setMobileOpen,
      closeMobile,
      toggleMobile,
    }),
    [
      collapsed,
      toggle,
      setCollapsed,
      mobileOpen,
      setMobileOpen,
      closeMobile,
      toggleMobile,
    ],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

// ----------------------------------------------------------------------------
// Sidebar shell
// ----------------------------------------------------------------------------

export function Sidebar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const { collapsed, mobileOpen, closeMobile } = useSidebar();
  return (
    <>
      {/* Mobile backdrop — only mounted while the drawer is open, < lg only. */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className={cn(
            "fixed inset-0 z-40 bg-bg/60 backdrop-blur-sm lg:hidden",
            "transition-opacity duration-200",
          )}
        />
      ) : null}

      <aside
        data-collapsed={collapsed ? "true" : "false"}
        data-mobile-open={mobileOpen ? "true" : "false"}
        className={cn(
          // ── Mobile (< lg): slide-over drawer pinned to the left.
          // The shell shows it via `fixed` + a translateX transform. We always
          // render the aside (so its internal state survives) and only toggle
          // visibility/transform; no layout shift.
          "fixed inset-y-0 left-0 z-50 m-3 flex flex-col",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          mobileOpen ? "translate-x-0" : "-translate-x-[110%]",
          // Mobile drawer is always at the expanded width — collapsing only
          // applies on desktop where the icon rail is useful.
          "w-[260px]",

          // ── Desktop (lg+): inline column inside the app-shell flex layout.
          // Reset the mobile-only positioning, drop the m-3 (the parent owns
          // the gutter on lg+), restore inline flow, and apply the collapse
          // width transition.
          "lg:static lg:m-0 lg:translate-x-0 lg:transition-[width]",
          "lg:h-full lg:shrink-0",
          collapsed ? "lg:w-[68px]" : "lg:w-[260px]",

          // Surface
          "rounded-2xl",
          "glass shadow-floating surface-highlight",
          "border border-border/50",
          "overflow-hidden",
          className,
        )}
        {...props}
      >
        {children}
      </aside>
    </>
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
        collapsed ? "lg:px-2 lg:py-2" : "lg:px-3 lg:py-3",
        // On mobile the drawer is always at expanded padding.
        "px-3 py-3",
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
      {title ? (
        <div
          className={cn(
            "px-2.5 pb-1.5 text-caption uppercase tracking-wider text-fg-muted",
            // Hide the title only when desktop-collapsed; mobile drawer always
            // renders at full width.
            collapsed && "lg:hidden",
          )}
        >
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
  /** External link — opens in new tab with rel=noreferrer. */
  external?: boolean;
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
  external,
}: SidebarItemProps) {
  const { collapsed, closeMobile } = useSidebar();
  if (!show) return null;

  const inner = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span
        className={cn(
          "truncate text-label-md",
          // Hide label only when desktop-collapsed; the mobile drawer is
          // always at full width.
          collapsed && "lg:sr-only",
        )}
      >
        {label}
      </span>
      {badge ? (
        <span className={cn("ml-auto shrink-0", collapsed && "lg:hidden")}>
          {badge}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "group flex h-9 items-center gap-3 rounded-md px-2.5",
    "transition-[background-color,color,box-shadow] duration-150",
    active
      ? "bg-surface-elevated text-fg shadow-inset-light"
      : "text-fg-secondary hover:bg-surface-elevated/60 hover:text-fg",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    disabled && "pointer-events-none opacity-40",
    collapsed && "lg:justify-center lg:px-0",
  );

  const handleClick = () => {
    onClick?.();
    closeMobile();
  };

  if (href && !disabled) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className={className}
          title={collapsed ? label : undefined}
          onClick={handleClick}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link
        href={href}
        className={className}
        title={collapsed ? label : undefined}
        onClick={handleClick}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
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
      // Hide the desktop collapse toggle on mobile — the drawer is opened/closed
      // by the hamburger trigger or backdrop, not by this affordance.
      className={cn(
        "hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md",
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
