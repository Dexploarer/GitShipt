import { cn } from "@repo/lib";

/**
 * Top-3 medal pill. Renders gold/silver/bronze background with `text-bg`
 * (which flips with the theme so dark text always reads on the medal).
 * Ranks 4+ render as muted mono numerals so the leaderboard rank column
 * stays compact and the top three remain visually distinct.
 */
export function RankMedal({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <span className="inline-flex w-7 justify-center text-mono-md text-fg-secondary">
        {rank}
      </span>
    );
  }
  const tone =
    rank === 1
      ? "bg-rank-gold"
      : rank === 2
        ? "bg-rank-silver"
        : "bg-rank-bronze";
  return (
    <span
      className={cn(
        "inline-grid size-7 place-items-center rounded-full text-mono-sm font-medium text-bg",
        tone,
      )}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}
