import * as React from "react";
import { AlertCircle, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface FormErrorProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Inline error chip rendered at the top of a form when a Server Action
 * returns a typed error. Uses the danger soft palette tokens — never raw hex.
 */
export function FormError({ message, onDismiss, className }: FormErrorProps) {
  return (
    <Card
      role="alert"
      depth="flat"
      padding="none"
      className={cn(
        "flex items-start gap-3 border-danger/40 bg-danger-soft p-3 text-danger",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1 text-body-sm">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="rounded-sm text-danger/80 transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </Card>
  );
}
