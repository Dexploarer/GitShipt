import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Input primitive — matches the design system's Liquid Glass surface vocab.
 *
 *   <Input placeholder="Search…" />
 *   <Input variant="glass" leadingIcon={<Search />} clearable onClear={...} />
 *
 * Composition: pass `leadingIcon` / `trailingIcon` / `clearable` to wrap the
 * input in a relative container with the affordances laid out by the
 * primitive — keeps consumers from re-implementing the same icon-padding
 * dance every time.
 */

const inputVariants = cva(
  cn(
    "w-full rounded-md text-body-md text-fg",
    "placeholder:text-fg-muted",
    "transition-[border-color,background-color,box-shadow] duration-150",
    "focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-inset-light",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ),
  {
    variants: {
      variant: {
        default:
          "border border-border-strong bg-surface hover:border-border-strong/80",
        glass: cn(
          "border border-border/60",
          "glass surface-highlight",
          "hover:border-border-strong",
        ),
        ghost:
          "border border-transparent bg-surface/40 hover:bg-surface-elevated/60",
      },
      size: {
        sm: "h-8 px-3 text-body-sm",
        default: "h-9 px-3",
        lg: "h-11 px-4 text-body-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "prefix"
> &
  VariantProps<typeof inputVariants> & {
    /** Icon rendered inside the input, left-aligned. */
    leadingIcon?: React.ReactNode;
    /** Icon rendered inside the input, right-aligned (overridden by `clearable` when value is present). */
    trailingIcon?: React.ReactNode;
    /** When true, renders an X button on the right that calls `onClear` (only visible when the input has a value). */
    clearable?: boolean;
    onClear?: () => void;
    /** Optional class for the outer wrapper (when leadingIcon / trailingIcon / clearable is present). */
    wrapperClassName?: string;
  };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      className,
      wrapperClassName,
      variant,
      size,
      leadingIcon,
      trailingIcon,
      clearable,
      onClear,
      value,
      ...props
    },
    ref,
  ) {
    const hasAffordances = Boolean(leadingIcon || trailingIcon || clearable);
    const showClear = clearable && Boolean(value);
    const padLeft = leadingIcon ? "pl-9" : "";
    const padRight = trailingIcon || showClear ? "pr-9" : "";

    if (!hasAffordances) {
      return (
        <input
          ref={ref}
          value={value}
          className={cn(inputVariants({ variant, size }), className)}
          {...props}
        />
      );
    }

    return (
      <div className={cn("relative flex items-center", wrapperClassName)}>
        {leadingIcon ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 flex size-4 items-center justify-center text-fg-muted"
          >
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          value={value}
          className={cn(
            inputVariants({ variant, size }),
            padLeft,
            padRight,
            className,
          )}
          {...props}
        />
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear"
            className="absolute right-2 inline-flex size-6 items-center justify-center rounded text-fg-muted hover:bg-surface-elevated hover:text-fg"
          >
            <span aria-hidden>×</span>
          </button>
        ) : trailingIcon ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 flex size-4 items-center justify-center text-fg-muted"
          >
            {trailingIcon}
          </span>
        ) : null}
      </div>
    );
  },
);
