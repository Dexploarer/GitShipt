"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@repo/lib";
import { Label } from "./label";
import { Separator } from "./separator";

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3",
        className,
      )}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-3 font-medium text-fg",
        "data-[variant=legend]:text-body-md data-[variant=label]:text-label-md",
        className,
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "flex w-full flex-col gap-7 [&>[data-slot=field-group]]:gap-4",
        className,
      )}
      {...props}
    />
  );
}

const fieldVariants = cva(
  "group/field flex w-full gap-3 data-[invalid=true]:text-danger",
  {
    variants: {
      orientation: {
        vertical: "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start",
        responsive:
          "flex-col sm:flex-row sm:items-center [&>*]:w-full sm:[&>*]:w-auto sm:[&>[data-slot=field-label]]:flex-auto [&>.sr-only]:w-auto",
      },
    },
    defaultVariants: { orientation: "vertical" },
  },
);

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("flex flex-1 flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn("group-data-[invalid=true]/field:text-danger", className)}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-body-sm text-fg-secondary", className)}
      {...props}
    />
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = React.useMemo(() => {
    if (children) return children;
    if (!errors?.length) return null;
    return errors
      .map((error) => error?.message)
      .filter(Boolean)
      .join(", ");
  }, [children, errors]);

  if (!content) return null;

  return (
    <div
      data-slot="field-error"
      className={cn("text-body-sm text-danger", className)}
      {...props}
    >
      {content}
    </div>
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-separator"
      className={cn(
        "relative flex items-center gap-2 text-body-sm text-fg-secondary",
        className,
      )}
      {...props}
    >
      <Separator className="flex-1" />
      {children ? <span>{children}</span> : null}
      <Separator className="flex-1" />
    </div>
  );
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
};
