"use client";

import { PageError } from "@/components/shared/PageError";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Couldn't load this project"
      description="We hit a snag fetching this repository's data. Try again, or head back to explore."
    />
  );
}
