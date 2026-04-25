import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Badge — small status chip. Per DESIGN.md, badge-live shows a 6px pulsing
 * green dot prefix. Use the `dot` prop to enable it for any semantic variant.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full text-label-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-surface-elevated text-fg-secondary border border-border",
        primary: "bg-primary-soft text-primary",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        outline: "border border-border-strong text-fg-secondary",
      },
      size: {
        sm: "px-2 py-0.5",
        default: "px-2.5 py-1",
        lg: "px-3 py-1.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotColor?: "success" | "warning" | "danger" | "info" | "primary";
}

export function Badge({
  className,
  variant,
  size,
  dot,
  dotColor,
  children,
  ...props
}: BadgeProps) {
  const dotClass = dotColor
    ? `bg-${dotColor}`
    : variant === "success"
      ? "bg-success"
      : variant === "warning"
        ? "bg-warning"
        : variant === "danger"
          ? "bg-danger"
          : variant === "info"
            ? "bg-info"
            : "bg-primary";

  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot ? (
        <span
          className={cn("size-1.5 rounded-full animate-pulse-dot", dotClass)}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}

export { badgeVariants };
