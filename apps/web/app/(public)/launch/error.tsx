"use client";

import { PageError } from "@/components/shared/PageError";

export default function LaunchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError error={error} reset={reset} title="Launch failed to load" />;
}
