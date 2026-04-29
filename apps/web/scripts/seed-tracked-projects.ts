/**
 * Seed externally-launched Bags tokens as `tracked` projects so they show
 * up in /explore and are reachable at /r/[org]/[repo]. These projects are
 * NOT operated by GitShipt — no payouts, no fee claims, no snapshots —
 * so workflow entry queries already exclude `status = 'tracked'`.
 *
 * What's persisted comes from real sources only:
 *   - ghOwner / ghRepo / ghRepoId from the public GitHub repo API
 *   - description / imageUrl (owner avatar) from the same response
 *   - tokenMint as supplied by the operator
 *
 * Anything we don't know stays null. The project page renders empty
 * states for leaderboard / payouts because no contributors have been
 * indexed (we don't run the indexer for tracked status).
 *
 * Run from repo root:  bun --env-file=.env.local apps/web/scripts/seed-tracked-projects.ts
 */
import { databaseUrl, databaseUrlUnpooled } from "@/lib/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, sql } from "drizzle-orm";
import { users, projects } from "@/db/schema";
import type { ScoringConfig, PayoutConfig } from "@/db/schema/projects";

interface TrackedSeed {
  ghOwner: string;
  ghRepo: string;
  tokenMint: string;
}

const SEEDS: TrackedSeed[] = [
  {
    ghOwner: "milady-ai",
    ghRepo: "milady",
    tokenMint: "Byb8WojwPWthyMm8iwtcd9CQhcZjnjQmhTRi5GN7BAGS",
  },
];

// `tracked` projects don't run scoring or payouts, but the columns are
// NOT NULL in the schema. Store inert defaults — never read by workflows.
const SCORING_CONFIG_PLACEHOLDER: ScoringConfig = {
  formulaVersion: "v1",
  windowDays: 30,
  weights: { mergedPRs: 0, commits: 0, reviews: 0, issues: 0, netLines: 0 },
  decay: "off",
  botBlocklist: [],
  botAllowlist: [],
};
const PAYOUT_CONFIG_PLACEHOLDER: PayoutConfig = {
  topN: 0,
  tierWeights: [],
  claimThresholdLamports: 0,
};

const SYSTEM_USER_EMAIL = "system+tracked@gitshipt.local";
const SYSTEM_USER_NAME = "GitShipt System";

interface GitHubRepoApiResponse {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  owner: { avatar_url: string | null };
}

async function fetchRepo(
  owner: string,
  repo: string,
): Promise<GitHubRepoApiResponse> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "gitshipt-seed-tracked",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(
      `GitHub repo fetch failed: ${owner}/${repo} → ${res.status} ${res.statusText}`,
    );
  }
  return (await res.json()) as GitHubRepoApiResponse;
}

async function main(): Promise<void> {
  const url = databaseUrlUnpooled() ?? databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL / DATABASE_URL_UNPOOLED missing");
  }
  const sqlClient = postgres(url, { max: 1 });
  const db = drizzle(sqlClient);

  try {
    // 1. Upsert system user. Lookup is by email (unique) so we don't
    //    leak duplicates if this seed is re-run with a fresh user id.
    const [systemUser] = await db
      .insert(users)
      .values({
        name: SYSTEM_USER_NAME,
        email: SYSTEM_USER_EMAIL,
        emailVerified: false,
        role: "user",
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { updatedAt: sql`now()` },
      })
      .returning({ id: users.id });

    if (!systemUser) throw new Error("failed to upsert system user");
    console.log(`[seed] system user id=${systemUser.id}`);

    for (const seed of SEEDS) {
      console.log(`[seed] ${seed.ghOwner}/${seed.ghRepo} → fetching GitHub`);
      const gh = await fetchRepo(seed.ghOwner, seed.ghRepo);

      // Re-running the seed refreshes metadata for tracked rows but
      // never clobbers a real (live/draft/etc.) project that happens
      // to share the slug. Done as select-then-update so behavior is
      // explicit and doesn't depend on `setWhere` semantics.
      const [existing] = await db
        .select({ id: projects.id, status: projects.status })
        .from(projects)
        .where(
          and(
            eq(projects.ghOwner, seed.ghOwner),
            eq(projects.ghRepo, seed.ghRepo),
          ),
        )
        .limit(1);

      if (existing && existing.status !== "tracked") {
        console.warn(
          `  ! ${seed.ghOwner}/${seed.ghRepo} exists with status='${existing.status}' — skipping (not a tracked row)`,
        );
        continue;
      }

      if (existing) {
        await db
          .update(projects)
          .set({
            ghRepoId: String(gh.id),
            name: gh.full_name,
            description: gh.description,
            imageUrl: gh.owner.avatar_url,
            tokenMint: seed.tokenMint,
            updatedAt: sql`now()`,
          })
          .where(eq(projects.id, existing.id));
      } else {
        await db.insert(projects).values({
          ownerUserId: systemUser.id,
          ghOwner: seed.ghOwner,
          ghRepo: seed.ghRepo,
          ghRepoId: String(gh.id),
          name: gh.full_name,
          description: gh.description,
          imageUrl: gh.owner.avatar_url,
          tokenMint: seed.tokenMint,
          status: "tracked",
          scoringConfig: SCORING_CONFIG_PLACEHOLDER,
          payoutConfig: PAYOUT_CONFIG_PLACEHOLDER,
        });
      }

      console.log(
        `  ✓ ${gh.full_name} (gh_id=${gh.id}, mint=${seed.tokenMint})`,
      );
    }
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
