"use client";

import { CheckIcon } from "lucide-react";
import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cn } from "@repo/lib";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-sm border border-border-strong bg-surface shadow-press outline-none transition-[background-color,border-color,box-shadow]",
        "focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-fg",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckIcon aria-hidden className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
