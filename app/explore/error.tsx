"use client";

import { PageError } from "@/components/shared/PageError";

export default function ExploreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError error={error} reset={reset} title="Explore failed to load" />;
}
