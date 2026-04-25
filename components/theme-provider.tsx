"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Thin wrapper around next-themes following DESIGN.md theming spec:
 * - attribute="data-theme" so token overrides under [data-theme="light"] resolve
 * - defaultTheme="system" so first-load matches the user's OS preference
 * - disableTransitionOnChange to avoid flash on toggle
 *
 * The corresponding `<html>` element in app/layout.tsx must use
 * `suppressHydrationWarning` to allow next-themes to hydrate the resolved theme.
 */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    />
  );
}
