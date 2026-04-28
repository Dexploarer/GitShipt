import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@repo/lib";

/**
 * Button primitive. shadcn-style: variants via cva, polymorphic via the
 * `asChild` prop using React's Slot.
 *
 * Variants follow DESIGN.md component spec:
 *  - primary  : the only green button on a screen
 *  - secondary: elevated surface + strong border
 *  - ghost    : transparent until hover
 *  - danger   : destructive admin actions
 *  - outline  : border-only neutral
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "gb-control rounded-md text-label-md font-semibold select-none",
    "transition-[background-color,border-color,box-shadow,color,filter,transform] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "gb-control-primary border border-primary bg-primary text-primary-fg",
        secondary:
          "gb-control-secondary border border-border-strong bg-surface-elevated [color:var(--fg)]",
        ghost:
          "gb-control-ghost border border-transparent bg-transparent [color:var(--fg-secondary)] hover:[color:var(--fg)]",
        danger:
          "gb-control-danger border border-danger bg-danger text-primary-fg",
        outline:
          "gb-control-outline border border-border-strong bg-transparent [color:var(--fg)]",
        link: "gb-control-link border border-transparent bg-transparent [color:var(--fg-secondary)] hover:[color:var(--fg)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-label-sm",
        default: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, asChild = false, ...props },
    ref,
  ) {
    const Comp = asChild ? Slot.Root : "button";

    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

export { buttonVariants };
