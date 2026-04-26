"use client";

import { PageError } from "@/components/shared/PageError";

export default function LeaderboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError error={error} reset={reset} title="Leaderboard failed to load" />;
}
