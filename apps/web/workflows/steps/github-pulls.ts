import { installationOctokit } from "@/lib/github/app";
import {
  fetchMergedPRsByAuthor,
  type ContributorAggregate,
} from "@/lib/github/indexer";

/**
 * Step helper — fetch merged PRs for a single project. Marked `'use step'`
 * so workflow runners memoize. Returns plain JSON-serializable array.
 */
export async function stepFetchMergedPRs(
  installationId: string,
  owner: string,
  repo: string,
  sinceISO: string,
): Promise<ContributorAggregate[]> {
  "use step";
  const octo = await installationOctokit(installationId);
  const m = await fetchMergedPRsByAuthor(octo, owner, repo, sinceISO);
  return Array.from(m.values());
}
