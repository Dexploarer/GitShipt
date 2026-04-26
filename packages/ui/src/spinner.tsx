import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@repo/lib";

/**
 * Small CSS-only spinner. Pure SVG arc + Tailwind animate-spin. Color is
 * driven by currentColor so the `color` variant simply maps to a text token.
 */
const spinnerVariants = cva("inline-block animate-spin", {
  variants: {
    size: {
      sm: "size-3",
      default: "size-4",
      lg: "size-6",
    },
    color: {
      primary: "text-primary",
      fg: "text-fg",
      inherit: "text-current",
    },
  },
  defaultVariants: { size: "default", color: "inherit" },
});

export interface SpinnerProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, "color">,
    VariantProps<typeof spinnerVariants> {
  /** Accessible label. Defaults to "Loading". */
  label?: string;
}

export function Spinner({
  className,
  size,
  color,
  label = "Loading",
  ...props
}: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      viewBox="0 0 24 24"
      fill="none"
      className={cn(spinnerVariants({ size, color }), className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.2"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { spinnerVariants };
