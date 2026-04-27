"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@repo/lib";

function TooltipProvider(
  props: React.ComponentProps<typeof TooltipPrimitive.Provider>,
) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={200}
      {...props}
    />
  );
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>,
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-xs overflow-hidden rounded-md border border-border bg-surface-overlay px-3 py-1.5 text-body-sm text-fg shadow-popover",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-surface-overlay" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
