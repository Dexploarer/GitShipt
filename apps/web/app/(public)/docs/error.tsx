"use client";

import { PageError } from "@/components/shared/PageError";

export default function DocsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError error={error} reset={reset} title="Docs failed to load" />;
}
