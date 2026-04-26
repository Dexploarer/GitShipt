import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@repo/lib";

export interface BreadcrumbItem {
  label: string;
  /** When omitted, the item is the current page (rendered as text, not a link). */
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Reusable breadcrumb trail. Server-component-safe.
 *
 * Per DESIGN.md: small horizontal list separated by chevron icons. The last
 * item is the current page (no link, `text-fg`); preceding items are links
 * in `fg-secondary` that brighten to `fg` on hover. Wraps on overflow.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-body-sm">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 ? (
                <ChevronRight
                  className="size-3 shrink-0 text-fg-muted"
                  aria-hidden
                />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={cn(
                    "rounded-sm text-fg-secondary transition-colors hover:text-fg",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? "text-fg" : "text-fg-secondary",
                    "truncate",
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
