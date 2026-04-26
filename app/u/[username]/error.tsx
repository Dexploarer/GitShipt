"use client";

import { PageError } from "@/components/shared/PageError";

export default function ContributorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError error={error} reset={reset} title="Couldn't load contributor" />;
}
