import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@repo/lib";

/**
 * Button primitive. shadcn-style: variants via cva, polymorphic via the
 * `asChild` prop using React's Slot.
 *
 * Variants follow DESIGN.md component spec:
 *  - primary  : the only purple button on a screen
 *  - secondary: elevated surface + strong border
 *  - ghost    : transparent until hover
 *  - danger   : destructive admin actions
 *  - outline  : border-only neutral
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-label-md select-none",
    "transition-[background-color,box-shadow,color,transform] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-fg shadow-card-elevated hover:bg-primary-hover active:bg-primary-pressed",
        secondary:
          "bg-surface-elevated text-fg border border-border-strong shadow-card-elevated hover:bg-surface-overlay",
        ghost:
          "bg-transparent text-fg-secondary hover:bg-surface-elevated hover:text-fg",
        danger:
          "bg-danger text-fg shadow-card-elevated hover:brightness-110",
        outline:
          "bg-transparent text-fg border border-border-strong hover:bg-surface-elevated",
        link:
          "bg-transparent text-fg-secondary hover:text-fg underline-offset-4 hover:underline",
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
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// Tiny Slot replacement (avoids pulling in @radix-ui). Renders the only child
// with merged className and props. If asChild is true, the child must accept
// className + ref; we just clone with merged className.
function SlotPolyfill({
  asChild,
  className,
  children,
  ...rest
}: { asChild?: boolean; className?: string; children: React.ReactNode } & Record<string, unknown>) {
  if (asChild && React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, {
      ...rest,
      className: cn((children.props as { className?: string }).className, className),
    } as React.HTMLAttributes<HTMLElement>);
  }
  return null;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, asChild = false, children, ...props }, ref) {
    const merged = cn(buttonVariants({ variant, size }), className);
    if (asChild) {
      return (
        <SlotPolyfill asChild className={merged} {...props}>
          {children}
        </SlotPolyfill>
      );
    }
    return (
      <button ref={ref} className={merged} {...props}>
        {children}
      </button>
    );
  },
);

export { buttonVariants };
