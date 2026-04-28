// Pure-JS seeder so we don't need a TS bundler in the script path.
// Mirrors lib/queries/seed.ts but talks directly to Postgres.
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.DATABASE_POSTGRES_URL ??
  process.env.DATABASE_POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error("Set DATABASE_URL or POSTGRES_URL before running seed-demo.");
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

const DEFAULT_SCORING = {
  formulaVersion: "v0",
  windowDays: 30,
  weights: {
    mergedPRs: 3.0,
    commits: 1.0,
    reviews: 1.5,
    issues: 0.5,
    netLines: 0.2,
  },
  decay: "linear",
  botBlocklist: ["dependabot", "renovate-bot", "github-actions"],
  botAllowlist: [],
};
const DEFAULT_PAYOUT = {
  topN: 10,
  tierWeights: [0.3, 0.2, 0.15, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
  claimThresholdLamports: 100_000_000,
};

const DEMO_CONTRIBUTORS = [
  { gh: "SYMBaiEX", id: "1001", prs: 18, commits: 142, score: 12456 },
  { gh: "alice", id: "1002", prs: 12, commits: 98, score: 9812 },
  { gh: "bob", id: "1003", prs: 9, commits: 76, score: 7320 },
  { gh: "carol", id: "1004", prs: 6, commits: 54, score: 5680 },
  { gh: "dave", id: "1005", prs: 5, commits: 41, score: 4215 },
  { gh: "erin", id: "1006", prs: 4, commits: 38, score: 3890 },
  { gh: "frank", id: "1007", prs: 4, commits: 30, score: 3120 },
  { gh: "grace", id: "1008", prs: 3, commits: 28, score: 2745 },
  { gh: "heidi", id: "1009", prs: 3, commits: 22, score: 2310 },
  { gh: "ivan", id: "1010", prs: 2, commits: 19, score: 1980 },
];

function genId() {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let id = "";
  for (let i = 0; i < 21; i++)
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

const demoEmail = "demo+gitbags@gitbags.local";

let [owner] = await sql`select * from users where email = ${demoEmail} limit 1`;
if (!owner) {
  const id = genId();
  await sql`
    insert into users (id, name, email, email_verified, github_username, github_id, role)
    values (${id}, 'GitBags Demo', ${demoEmail}, true, 'SYMBaiEX', 'demo-1000', 'user')
  `;
  owner = { id };
  console.log("Created demo owner:", id);
} else {
  console.log("Reusing demo owner:", owner.id);
}

// Fake but plausibly-shaped mint address (44 base58 chars). Real launches
// fill this in via the Bags SDK. The Solscan link will 404 on this fake
// — that's expected for the demo.
const DEMO_TOKEN_MINT = "GBAGSdemoTokenMint11111111111111111111111111";
const DEMO_BAGS_LAUNCH_ID = "bags_launch_demo_gitbags_v0";

let [project] = await sql`
  select * from projects where gh_owner = 'SYMBaiEX' and gh_repo = 'gitbags' limit 1
`;
if (!project) {
  const id = genId();
  await sql`
    insert into projects (
      id, owner_user_id, gh_owner, gh_repo, gh_repo_id, name, description,
      status, platform_fee_bps, scoring_config, payout_config,
      token_mint, bags_launch_id
    ) values (
      ${id}, ${owner.id}, 'SYMBaiEX', 'gitbags', 'demo-repo-1', 'GitBags',
      'Pump.fm for open source. Daily trading fees redistribute to top contributors.',
      'simulated_live', 500, ${JSON.stringify(DEFAULT_SCORING)}::jsonb, ${JSON.stringify(DEFAULT_PAYOUT)}::jsonb,
      ${DEMO_TOKEN_MINT}, ${DEMO_BAGS_LAUNCH_ID}
    )
  `;
  project = { id };
  console.log("Created demo project:", id);
} else {
  // Idempotent: ensure the demo project always has the launched-token state.
  await sql`
    update projects
    set token_mint = ${DEMO_TOKEN_MINT},
        bags_launch_id = ${DEMO_BAGS_LAUNCH_ID},
        status = 'simulated_live',
        simulated_at = coalesce(simulated_at, now())
    where id = ${project.id}
  `;
  console.log("Reusing demo project:", project.id, "(token_mint refreshed)");
}

for (let i = 0; i < DEMO_CONTRIBUTORS.length; i++) {
  const c = DEMO_CONTRIBUTORS[i];
  const id = genId();
  const inputs = {
    mergedPRs: c.prs,
    commits: c.commits,
    reviews: 0,
    issues: 0,
    netLines: 0,
  };
  await sql`
    insert into contributors (
      id, project_id, gh_user_id, gh_username, avatar_url,
      score, rank, inputs, last_indexed_at
    ) values (
      ${id}, ${project.id}, ${c.id}, ${c.gh}, ${"https://github.com/" + c.gh + ".png"},
      ${c.score}, ${i + 1}, ${JSON.stringify(inputs)}::jsonb, now()
    )
    on conflict (project_id, gh_user_id) do update set
      score = excluded.score,
      rank = excluded.rank,
      inputs = excluded.inputs,
      last_indexed_at = now()
  `;
}

const [{ count }] =
  await sql`select count(*)::int as count from contributors where project_id = ${project.id}`;
console.log(`Seeded ${count} contributors for project ${project.id}`);
console.log(`Visit: http://localhost:3000/r/SYMBaiEX/gitbags`);

await sql.end();
