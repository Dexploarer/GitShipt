import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@repo/ui";
import { cn } from "@repo/lib";

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** Secondary value rendered beneath the primary one (e.g. USD subtext). */
  sub?: React.ReactNode;
  icon?: LucideIcon;
  /** When true, value is rendered with mono — default true (per design rules). */
  mono?: boolean;
  /** Optional accent — only one tile per viewport should use `primary`. */
  accent?: "primary" | "neutral" | "success" | "warning" | "danger";
  className?: string;
}

const accentClass: Record<NonNullable<StatTileProps["accent"]>, string> = {
  primary: "text-primary",
  neutral: "text-fg",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * Canonical KPI tile used by both the project-owner dashboard and the admin
 * console. Renders:
 *   - small label (label-sm + fg-secondary) with an optional Lucide icon
 *   - large numeric value (mono-md + headline-sm by default)
 *   - optional muted subtext beneath
 *
 * Uses Card depth="raised" so a tile-row of these has a subtle pop.
 */
export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  mono = true,
  accent = "neutral",
  className,
}: StatTileProps) {
  return (
    <Card
      depth="raised"
      padding="default"
      className={cn("flex h-full flex-col justify-between gap-3", className)}
    >
      <div className="flex items-center justify-between gap-2 text-label-sm text-fg-secondary">
        <span className="truncate">{label}</span>
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0 text-fg-muted",
              accent === "primary" && "text-primary",
            )}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex items-baseline gap-2">
        <div
          className={cn(
            "leading-none",
            mono ? "text-mono-md text-headline-sm" : "text-headline-sm",
            accentClass[accent],
          )}
        >
          {value}
        </div>
      </div>
      {sub ? (
        <div className="truncate text-caption text-fg-muted">{sub}</div>
      ) : null}
    </Card>
  );
}
