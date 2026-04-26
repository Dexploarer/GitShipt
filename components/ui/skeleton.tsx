import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Animated shimmer placeholder. Uses animate-pulse over bg-surface-elevated so
 * it sits naturally on either the page bg or an elevated card. Both palettes
 * resolve via design tokens.
 */
const skeletonVariants = cva("animate-pulse bg-surface-elevated", {
  variants: {
    shape: {
      text: "h-4 w-full rounded-sm",
      block: "h-24 w-full rounded-md",
      circle: "size-10 rounded-full",
    },
  },
  defaultVariants: { shape: "text" },
});

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

export function Skeleton({ className, shape, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(skeletonVariants({ shape }), className)}
      {...props}
    />
  );
}

export interface SkeletonTextProps {
  /** Number of shimmer lines to render. Defaults to 3. */
  lines?: number;
  /** Width of the final line as a Tailwind width utility (e.g. "w-1/2"). */
  lastLineWidth?: string;
  className?: string;
}

/**
 * Convenience wrapper for multi-line text shimmers. Renders `lines` of
 * <Skeleton shape="text" /> with the last line slightly truncated so it reads
 * as a paragraph rather than a block.
 */
export function SkeletonText({
  lines = 3,
  lastLineWidth = "w-2/3",
  className,
}: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          shape="text"
          className={cn(i === lines - 1 && lines > 1 && lastLineWidth)}
        />
      ))}
    </div>
  );
}

export { skeletonVariants };
