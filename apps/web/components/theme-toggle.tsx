"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@repo/lib";

/**
 * Three-state theme toggle. Cycle: system → light → dark → system.
 * This is the ONLY component allowed to call useTheme(). Everything else
 * uses the design tokens, which resolve automatically per data-theme.
 *
 * Note: we delay rendering the icon until mounted to avoid a hydration
 * mismatch (the resolved theme is unknown at SSR time).
 */
const ORDER = ["system", "light", "dark"] as const;
type ThemeMode = (typeof ORDER)[number];

const ICON: Record<ThemeMode, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const LABEL: Record<ThemeMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const current: ThemeMode = mounted
    ? ((theme ?? "system") as ThemeMode)
    : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] as ThemeMode;
  const Icon = ICON[current];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[current]}, click to switch to ${LABEL[next]}`}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md",
        "text-fg-secondary hover:bg-surface-elevated hover:text-fg",
        "transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
