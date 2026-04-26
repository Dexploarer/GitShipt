import * as React from "react";
import { cn } from "@repo/lib";

export interface FormFieldProps {
  /** Visible label text. When omitted, label is rendered sr-only. */
  label?: string;
  /** Falls back to the child's id when not supplied. */
  htmlFor?: string;
  /** Helper text shown below the control when no error is set. */
  hint?: string;
  /** Server- or client-side validation error. Replaces hint when present. */
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps a form control in a consistent label + control + hint/error layout.
 *
 * Implementation note: we use React.cloneElement on a single child so the
 * control automatically gets aria-invalid and aria-describedby linking to
 * the hint/error <p>. Keeps call sites terse — the consumer just renders an
 * <Input/>, no manual ARIA wiring required. For multiple controls (radio
 * group, checkbox stack), pass them inside a fragment + use htmlFor / manual
 * ARIA on the children.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const reactId = React.useId();
  const child = React.Children.only(children) as React.ReactElement<{
    id?: string;
    "aria-invalid"?: boolean | "true" | "false";
    "aria-describedby"?: string;
    "aria-required"?: boolean | "true" | "false";
  }>;

  const childId = htmlFor ?? child.props.id ?? `${reactId}-control`;
  const messageId = error || hint ? `${reactId}-msg` : undefined;

  const enhanced = React.cloneElement(child, {
    id: childId,
    "aria-invalid": error ? true : child.props["aria-invalid"],
    "aria-describedby":
      [child.props["aria-describedby"], messageId]
        .filter(Boolean)
        .join(" ") || undefined,
    "aria-required": required ? true : child.props["aria-required"],
  });

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={childId}
        className={cn("text-label-sm text-fg-secondary", !label && "sr-only")}
      >
        {label ?? "Field"}
        {label && required ? (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {enhanced}
      {error ? (
        <p id={messageId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-caption text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
