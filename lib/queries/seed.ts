import "server-only";
import { dbHttp } from "@/db";
import {
  users,
  projects,
  contributors,
  type ScoringConfig,
  type PayoutConfig,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

const DEFAULT_SCORING: ScoringConfig = {
  formulaVersion: "v0",
  windowDays: 30,
  weights: { mergedPRs: 3.0, commits: 1.0, reviews: 1.5, issues: 0.5, netLines: 0.2 },
  decay: "linear",
  botBlocklist: ["dependabot", "renovate-bot", "github-actions"],
  botAllowlist: [],
};

const DEFAULT_PAYOUT: PayoutConfig = {
  topN: 10,
  tierWeights: [0.30, 0.20, 0.15, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
  claimThresholdLamports: 100_000_000, // 0.1 SOL
};

const DEMO_CONTRIBUTORS = [
  { gh: "SYMBaiEX", id: "1001", prs: 18, commits: 142, score: 12_456 },
  { gh: "alice", id: "1002", prs: 12, commits: 98, score: 9_812 },
  { gh: "bob", id: "1003", prs: 9, commits: 76, score: 7_320 },
  { gh: "carol", id: "1004", prs: 6, commits: 54, score: 5_680 },
  { gh: "dave", id: "1005", prs: 5, commits: 41, score: 4_215 },
  { gh: "erin", id: "1006", prs: 4, commits: 38, score: 3_890 },
  { gh: "frank", id: "1007", prs: 4, commits: 30, score: 3_120 },
  { gh: "grace", id: "1008", prs: 3, commits: 28, score: 2_745 },
  { gh: "heidi", id: "1009", prs: 3, commits: 22, score: 2_310 },
  { gh: "ivan", id: "1010", prs: 2, commits: 19, score: 1_980 },
];

export interface SeedResult {
  projectId: string;
  contributorCount: number;
  created: boolean;
}

/**
 * Seed a demo project ("gitbags" by SYMBaiEX) with 10 ranked contributors
 * so the public project page renders against real DB rows. Idempotent: if
 * the project already exists, only contributors are upserted.
 */
export async function seedDemoProject(): Promise<SeedResult> {
  // Need an owner user. Find or create a synthetic user for demo seeding.
  const demoEmail = "demo+gitbags@gitbags.local";
  let [owner] = await dbHttp.select().from(users).where(eq(users.email, demoEmail)).limit(1);
  if (!owner) {
    const inserted = await dbHttp
      .insert(users)
      .values({
        name: "GitBags Demo",
        email: demoEmail,
        emailVerified: true,
        githubUsername: "SYMBaiEX",
        githubId: "demo-1000",
        role: "user",
      })
      .returning();
    owner = inserted[0]!;
  }

  let [project] = await dbHttp
    .select()
    .from(projects)
    .where(and(eq(projects.ghOwner, "SYMBaiEX"), eq(projects.ghRepo, "gitbags")))
    .limit(1);

  let created = false;
  if (!project) {
    const inserted = await dbHttp
      .insert(projects)
      .values({
        ownerUserId: owner.id,
        ghOwner: "SYMBaiEX",
        ghRepo: "gitbags",
        ghRepoId: "demo-repo-1",
        name: "GitBags",
        description:
          "Pump.fm for open source. Daily trading fees redistribute to top contributors.",
        imageUrl: null,
        status: "simulated_live",
        tokenMint: "GBAGSdemoTokenMint11111111111111111111111111",
        bagsLaunchId: "bags_launch_demo_gitbags_v0",
        simulatedAt: new Date(),
        platformFeeBps: 500,
        scoringConfig: DEFAULT_SCORING,
        payoutConfig: DEFAULT_PAYOUT,
      })
      .returning();
    project = inserted[0]!;
    created = true;
  } else {
    const [updated] = await dbHttp
      .update(projects)
      .set({
        tokenMint: "GBAGSdemoTokenMint11111111111111111111111111",
        bagsLaunchId: "bags_launch_demo_gitbags_v0",
        status: "simulated_live",
        simulatedAt: project.simulatedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .returning();
    project = updated ?? project;
  }

  for (let i = 0; i < DEMO_CONTRIBUTORS.length; i++) {
    const c = DEMO_CONTRIBUTORS[i]!;
    await dbHttp
      .insert(contributors)
      .values({
        projectId: project.id,
        ghUserId: c.id,
        ghUsername: c.gh,
        avatarUrl: `https://github.com/${c.gh}.png`,
        score: c.score,
        rank: i + 1,
        inputs: {
          mergedPRs: c.prs,
          commits: c.commits,
          reviews: 0,
          issues: 0,
          netLines: 0,
        },
        lastIndexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [contributors.projectId, contributors.ghUserId],
        set: {
          score: c.score,
          rank: i + 1,
          inputs: sql`excluded.inputs`,
          lastIndexedAt: new Date(),
        },
      });
  }

  return {
    projectId: project.id,
    contributorCount: DEMO_CONTRIBUTORS.length,
    created,
  };
}
