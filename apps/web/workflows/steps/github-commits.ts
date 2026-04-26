import { installationOctokit } from "@/lib/github/app";
import {
  fetchCommitsByAuthor,
  type ContributorAggregate,
} from "@/lib/github/indexer";

/**
 * Step helper — fetch commits on a project's default branch. Returns a
 * JSON-serializable array; the workflow combines this with PRs via
 * `mergeAggregates`.
 */
export async function stepFetchCommits(
  installationId: string,
  owner: string,
  repo: string,
  sinceISO: string,
  defaultBranch: string,
): Promise<ContributorAggregate[]> {
  "use step";
  const octo = await installationOctokit(installationId);
  const m = await fetchCommitsByAuthor(
    octo,
    owner,
    repo,
    sinceISO,
    defaultBranch,
  );
  return Array.from(m.values());
}
