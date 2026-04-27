"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@repo/lib";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer inline-flex shrink-0 items-center rounded-full border border-transparent bg-surface-elevated shadow-press outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        "data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        data-size={size}
        className={cn(
          "pointer-events-none block rounded-full bg-fg shadow-card-elevated transition-transform",
          "data-[state=checked]:bg-fg data-[state=unchecked]:bg-fg-secondary",
          "data-[size=default]:size-4 data-[size=sm]:size-3",
          "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5",
          "data-[size=sm]:data-[state=checked]:translate-x-3",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
