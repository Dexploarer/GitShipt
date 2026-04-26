"use client";

import { PageError } from "@/components/shared/PageError";

/**
 * Global app-level error boundary. Renders inside `<html>/<body>` from the
 * root layout when an error is thrown above any nested boundary. Doesn't
 * assume the app shell — keeps a minimal centered layout.
 */
export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[calc(100vh-2rem)] items-center justify-center bg-bg p-4">
      <PageError error={error} reset={reset} />
    </main>
  );
}
