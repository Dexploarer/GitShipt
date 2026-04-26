"use client";

import { PageError } from "@/components/shared/PageError";
import "./globals.css";

/**
 * Root error boundary. Replaces the root layout when even the root errors,
 * so it must render its own `<html>` + `<body>`. Keep it minimal: design
 * tokens via globals.css, no fonts/providers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg text-fg antialiased">
        <main className="flex min-h-screen items-center justify-center p-4">
          <PageError
            error={error}
            reset={reset}
            title="Application error"
            description="A critical error occurred and the page couldn't recover. Try again, or return home."
          />
        </main>
      </body>
    </html>
  );
}
