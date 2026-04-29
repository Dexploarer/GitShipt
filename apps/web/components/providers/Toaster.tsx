"use client";

import { Toaster as Sonner } from "sonner";

/**
 * App-wide toast surface.
 *
 * Sonner renders an `aria-live="polite"` region by default; we keep that and
 * add a `richColors` palette tied to the design tokens via CSS-variable
 * overrides in globals.css. Position is bottom-right so it doesn't collide
 * with the floating sidebar at top-left.
 *
 * Server actions and route handlers do not touch this directly. Client
 * components import { toast } from "sonner" and call e.g. toast.success(...)
 * after a Server Action returns.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      theme="system"
      // Touch target floor for mobile.
      toastOptions={{
        className: "gitshipt-toast",
        duration: 5000,
      }}
    />
  );
}
