import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@repo/lib";

/**
 * Pill — fully-rounded interactive chip. Distinct from Badge in that pills
 * are intended to be clickable (filter tags, action affordances), Badges
 * are passive status indicators.
 */
const pillVariants = cva(
  [
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full",
    "text-label-sm font-medium select-none",
    "transition-colors",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary-soft text-primary-readable hover:brightness-110",
        neutral:
          "bg-surface-elevated text-fg-secondary border border-border hover:bg-surface-overlay hover:text-fg",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
      },
      size: {
        sm: "px-2.5 py-1",
        default: "px-3 py-1.5",
      },
      interactive: {
        true: "gb-pill-interactive cursor-pointer",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      interactive: false,
    },
  },
);

export interface PillProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {}

export function Pill({
  className,
  variant,
  size,
  interactive,
  ...props
}: PillProps) {
  return (
    <span
      className={cn(pillVariants({ variant, size, interactive }), className)}
      {...props}
    />
  );
}

export { pillVariants };
