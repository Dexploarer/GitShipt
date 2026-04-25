import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  cta?: { label: string; href: string };
  /** Optional secondary action (rendered as ghost button). */
  secondary?: { label: string; href: string };
  className?: string;
}

/**
 * Reusable empty state — centered icon, title, supporting copy, primary CTA.
 * Per DESIGN.md: never illustrated, just a single Lucide icon in `fg-muted`.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  secondary,
  className,
}: EmptyStateProps) {
  return (
    <Card
      depth="flat"
      padding="lg"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        className,
      )}
    >
      <Icon className="size-12 text-fg-muted" aria-hidden />
      <h3 className="text-headline-sm text-fg">{title}</h3>
      {description ? (
        <p className="max-w-md text-body-md text-fg-secondary">
          {description}
        </p>
      ) : null}
      {(cta || secondary) && (
        <div className="mt-1 flex items-center gap-2">
          {cta ? (
            <Button asChild variant="primary" size="default">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          ) : null}
          {secondary ? (
            <Button asChild variant="ghost" size="default">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  );
}
