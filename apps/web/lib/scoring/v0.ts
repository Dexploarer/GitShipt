/**
 * GitBags scoring formula v0 — pure functions, no I/O.
 *
 * Score = w_pr * mergedPRs
 *       + w_commit * commits
 *       + w_review * reviews
 *       + w_issue * issues
 *       + w_lines * log10(1 + max(0, netLines))
 *
 * Default weights match the PRD; per-project `scoringConfig.weights`
 * may override any of them. Time decay is applied per-event upstream;
 * `applyTimeDecay` here is the pure helper used by aggregator code.
 */

export const BOT_REGEX = /^(.*-bot|dependabot|.*-ci|renovate)$/i;

export type ScoreInputs = {
  mergedPRs: number;
  commits: number;
  reviews: number;
  issues: number;
  netLines: number;
};

export type ScoreWeights = {
  mergedPRs: number;
  commits: number;
  reviews: number;
  issues: number;
  netLines: number;
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  mergedPRs: 3.0,
  commits: 1.0,
  reviews: 1.5,
  issues: 0.5,
  netLines: 0.2,
};

/**
 * Returns true when a login looks bot-like, after applying the
 * per-project allowlist (force include) and blocklist (force exclude).
 */
export function isBot(
  login: string,
  allowlist: string[],
  blocklist: string[],
): boolean {
  const lower = login.toLowerCase();
  if (allowlist.some((x) => x.toLowerCase() === lower)) return false;
  if (blocklist.some((x) => x.toLowerCase() === lower)) return true;
  return BOT_REGEX.test(lower);
}

/**
 * Pure scoring function. Treats negative inputs as zero defensively.
 */
export function computeRawScore(
  inputs: ScoreInputs,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  const merged = Math.max(0, inputs.mergedPRs);
  const commits = Math.max(0, inputs.commits);
  const reviews = Math.max(0, inputs.reviews);
  const issues = Math.max(0, inputs.issues);
  const lines = Math.max(0, inputs.netLines);

  return (
    weights.mergedPRs * merged +
    weights.commits * commits +
    weights.reviews * reviews +
    weights.issues * issues +
    weights.netLines * Math.log10(1 + lines)
  );
}

/**
 * Linear time decay: weight scaled by `(W - daysAgo) / W`, clipped to [0, weight].
 * Returns 0 if `windowDays <= 0`.
 */
export function applyTimeDecay(
  weight: number,
  daysAgo: number,
  windowDays: number,
): number {
  if (windowDays <= 0) return 0;
  const factor = Math.max(0, (windowDays - daysAgo) / windowDays);
  return weight * factor;
}
