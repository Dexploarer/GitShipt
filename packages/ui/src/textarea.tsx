import * as React from "react";
import { cn } from "@repo/lib";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-24 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-body-md text-fg shadow-press outline-none transition-[border-color,box-shadow]",
        "placeholder:text-fg-muted focus-visible:border-primary focus-visible:shadow-inset-light disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
