"use client";

import * as React from "react";
import { Toaster as SonnerPrimitive, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerPrimitive>;

function Toaster({ className, toastOptions, ...props }: ToasterProps) {
  return (
    <SonnerPrimitive
      data-slot="sonner"
      className={className}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-overlay group-[.toaster]:text-fg group-[.toaster]:border-border group-[.toaster]:shadow-popover",
          description: "group-[.toast]:text-fg-secondary",
          actionButton:
            "gb-control gb-control-primary group-[.toast]:bg-primary group-[.toast]:text-primary-fg",
          cancelButton:
            "group-[.toast]:bg-surface-elevated group-[.toast]:text-fg-secondary",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
