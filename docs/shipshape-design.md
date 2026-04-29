# Shipshape — design doc

Spine for the GitShipt v1 contribution-economy product. Captures every
decision made during the design conversation that produced this branch.
Treat as the single source of truth for the implementation; if a code change
disagrees with this doc, the doc wins until updated by user approval.

Status: **draft, awaiting user review**. No implementation lands until this
doc is approved.

---

## 1. Goals

1. **Make the published scoring contract truthful.** Today the system advertises
   a 5-input formula but populates only 2 inputs. v1 closes that gap.
2. **Measure project alignment, not just activity.** A separate axis on top of
   score that asks "did this contribution ship a better product?" — sourced
   from issue links, label matches, file-area matches, and CI-driven quality
   signals (test pass rate, coverage delta, bundle delta, perf delta).
3. **Make the runbook the agent-facing contract.** Per-repo, scoring-aware
   markdown that any AI agent (Claude, Cursor, Copilot, Coderabbit) reads
   before working on the repo so its work is automatically scoring-aligned.
4. **Gate token launches on real GitHub authority.** A token can only be
   launched against a repo by a user who currently holds `admin` permission
   on that repo, with the GitShipt App installed and shipshape integrated.

## 2. Non-goals (v1)

- **Hosted AI review service** ("Agent Concierge"). Owners run their own AI
  tooling against the runbook. GitShipt does not run inference.
- **Full agent earnings routing enforcement.** v1 *publishes* the routing
  policy in shipshape and *captures* `Co-authored-by` trailers, but does
  not yet auto-route earnings between contributor rows. Enforcement is v2.
- **Substance-checking AI reviews** (do comments reference real diff symbols,
  do suggestions compile). v1 measures length + anchor density; substance
  detection is v2.
- **Fiat billing for any GitShipt-side service.** SOL only.
- **Existing-project grandfathering past 14 days.** See §11.

## 3. Three-PR plan

### PR 1 — data spine + dogfood (this branch, ~2 days)

- Scoring v1 (`lib/scoring/v1.ts`)
- Indexer v1 fixes (`lib/github/indexer.ts`)
- Schema migrations
- Alignment v1 (`lib/scoring/alignment.ts`)
- Shipshape + logbook generators (`lib/agents/`)
- Public routes for shipshape/logbook/runbook.json
- CI ingest endpoint + OIDC auth
- GitShipt's own self-reporting workflow
- GitShipt's own `shipshape.md` at repo root
- Public docs honesty fix
- Agent infrastructure carry-over: `SPEC.md`, `CLAUDE.md` invariants,
  `/audit` and `/spike` skills, typecheck Stop hook

### PR 2 — launch gate + install kit + format adapters (~2 days)

- Launch state machine: `pending_install → awaiting_pr_merge → ready_to_launch → launched`
- Admin-permission verification helpers
- Auto-PR-creation flow via the GitShipt App
- Install-merge webhook handler
- Format adapters: `CLAUDE.md`, `.cursor/rules/gitshipt.md`,
  `.github/copilot-instructions.md`
- The reusable `gitshipt/report-action@v1` (separate repo, stubbed here)
- E2E for gate failure paths (no admin, no App, no shipshape)
- Migration window enforcement for existing projects

### PR 3 — dashboard configurator (~1 day)

- `dashboard/projects/[id]/agents/`: alignment policy editor, agent routing
  policy, runbook preview, install button.

PR 1 ships the spine; PR 2 makes participation in the spine non-bypassable
for new launches; PR 3 makes the owner experience comfortable.

## 4. Naming

| File | Purpose | Cadence | Location |
|---|---|---|---|
| `shipshape.md` | Static rules: scoring rubric, attribution policy, alignment definitions, anti-gaming preflight | Changes rarely; version-controlled in repo | Live: `gitshipt.com/r/[org]/[repo]/shipshape.md`. Installed: repo root `shipshape.md`. |
| `logbook.md` | Live state: top contributors this period, recent activity, hot issues, last sync | Refreshes per snapshot | Live only: `gitshipt.com/r/[org]/[repo]/logbook.md`. Never committed to repo. |
| `runbook.json` | Machine-readable variant of shipshape | Same cadence as shipshape | `gitshipt.com/api/r/[org]/[repo]/runbook.json` |

Format adapters (PR 2) emit `CLAUDE.md`, `.cursor/rules/gitshipt.md`, and
`.github/copilot-instructions.md` derived from the same source.

## 5. Data model

### 5.1 `contributors.inputs` extension

```ts
export interface ContributorScoreInputs {
  // Existing
  mergedPRs: number;
  commits: number;
  reviews: number;             // newly populated in v1
  issues: number;              // newly populated in v1
  netLines: number;            // newly populated in v1
  // New in v1
  merges: number;              // count of *others'* PRs the contributor approved-and-merged
  reviewSubstantiveScore: number;  // length + anchor density + suggestion count
  coAuthored: number;          // commits where contributor appears in Co-authored-by trailer
  ci: ContributorCiInputs;     // see 5.2
}
```

### 5.2 `ContributorCiInputs` (new)

```ts
export interface ContributorCiInputs {
  prsTotal: number;
  prsGreenOnFirstPush: number;     // → passRateOnFirstPush = ratio
  coverageDeltaBp: number;         // basis points; positive = added coverage
  bundleDeltaBytes: number;        // negative = shrunk bundle
  perfDeltaBp: number;             // basis points; sign per project's "lower-is-better" hint
  vulnsIntroduced: number;
  vulnsEliminated: number;
  brokeMain: number;               // PRs that broke main and required revert
}
```

### 5.3 `projects.scoringConfig` extension

```ts
export interface ScoringConfig {
  formulaVersion: "v0" | "v1";
  windowDays: number;
  weights: {
    mergedPRs: number;
    commits: number;
    reviews: number;
    issues: number;
    netLines: number;
    merges: number;                 // NEW
    reviewSubstantiveScore: number; // NEW
    coAuthored: number;             // NEW
  };
  decay: "off" | "linear" | "exponential";
  perPrCommitCap: number;           // NEW; default 5
  perWindowPrCap: number;           // NEW; default 10 — see §6.5
  draftQueueEnabled: boolean;       // NEW; default true — see §6.5
  draftAutoReviewDelayHours: number;// NEW; default 24 — see §6.5
  trivialCommitFilter: boolean;     // NEW; default true
  substantiveReviewFloor: {         // NEW
    minBodyChars: number;            // default 200
    minAnchoredComments: number;     // default 1
  };
  botBlocklist: string[];
  botAllowlist: string[];
}
```

### 5.4 `projects.alignmentConfig` (new column, jsonb)

```ts
export interface AlignmentConfig {
  enabled: boolean;
  mode: "informational" | "asymmetric" | "multiplicative" | "gate";
  // Asymmetric mode parameters (the v1 default)
  floor: number;     // default 0.3 — below this, payout × 0.5
  ceiling: number;   // default 0.7 — above this, payout × 1.2
  belowFloorMultiplier: number;   // default 0.5
  aboveCeilingMultiplier: number; // default 1.2
  // Signal weights (sum used as numerator; cap to [0,1])
  signals: {
    linkedOpenIssue: number;        // default +0.30
    priorityLabelMatch: number;     // default +0.20
    fileAreaMatch: number;          // default +0.20
    maintainerRequested: number;    // default +0.30
    closedWithoutMerge: number;     // default −0.40
    nonGoalAreaTouch: number;       // default −0.30
    ciFirstPushPass: number;        // default +0.10
    ciCoveragePositive: number;     // default +0.10
    ciCoverageNegative: number;     // default −0.10
    ciBrokeMain: number;            // default −0.30
  };
  // Project-declared inventories
  priorityLabels: string[];        // e.g., ["P0","v2-roadmap"]
  priorityFileAreas: string[];     // glob patterns
  nonGoalFileAreas: string[];      // glob patterns
  issueLinkPolicy: "required" | "encouraged" | "optional";
}
```

### 5.5 `projects.agentRoutingPolicy` (new column, jsonb)

```ts
export interface AgentRoutingPolicy {
  defaultPolicy: "treasury" | "reject" | "split";
  splitTreasuryShare: number;      // 0..1; default 0.5 if split
  operatorShareCap: number;        // 0..1; default 0.30 — max % of period payout that can be operator-routed
  bindings: Array<{
    botGhLogin: string;            // e.g., "claude-code[bot]"
    operatorGhUserId: string;      // the human's gh user id
    operatorWalletAddress: string | null;
    boundAt: string;               // ISO
    cosignedBy: string[];          // gh user ids of cosigners (if team repo)
  }>;
  acceptCoAuthorTrailerCredit: boolean;  // default true
  coAuthorSplitRatio: number;      // 0..1, share to co-author; default 0.5
}
```

### 5.6 `contributors` extension

```ts
attributionType: "human" | "agent_routed" | "bot_treasury" | "agent_unrouted"
routesToContributorId: text | null   // soft FK to another contributor in same project
```

### 5.7 `projects.launchState` (PR 2 — referenced here for migration planning)

```ts
launchState: "pending_install" | "awaiting_pr_merge" | "ready_to_launch" | "launched" | "failed"
installRunbookPullRequestUrl: text | null
installRunbookPullRequestNumber: integer | null
installerGhUserId: text | null     // user who triggered install (must be admin)
```

### 5.8 Migration

Single Drizzle migration adds all of the above. Default values backfilled
for existing rows. `formulaVersion` defaults to `"v0"` for existing
projects (preserves current behavior); new projects default to `"v1"`.

## 6. Scoring v1

### 6.1 Formula

```
score = w_PR        * mergedPRs                    (default w 3.0)
      + w_commit    * cappedCommits                (default w 0.5, was 1.0 — codegen-era discount)
      + w_review    * reviews                      (default w 1.5; substantive only counts toward reviews)
      + w_subst     * reviewSubstantiveScore       (default w 1.0)
      + w_merge     * merges                       (default w 2.0)
      + w_issue     * issues                       (default w 0.5)
      + w_coauth    * coAuthored                   (default w 0.5)
      + w_lines     * log10(1 + netLines)          (default w 0.1, was 0.2)
```

`cappedCommits = min(commitsRaw, perPrCommitCap × mergedPRs + drive_by_allowance)`,
where `drive_by_allowance = 3` (lets unaffiliated contributors who push commits
without an open PR still score nominally).

### 6.2 Wired time decay

`computeRawScore` now accepts a `decayMultiplier` (computed upstream by the
indexer per-event) and applies it. The indexer computes `daysAgo` per event
relative to snapshot time, calls `applyTimeDecay(weight, daysAgo, windowDays)`,
and aggregates the decayed weight into the contributor's input row before the
score function runs. `decay: "off"` short-circuits this to identity.

### 6.3 Self-merge dampener (correct version)

The PR author always earns the PR credit. The merger bonus exists only if
`merger ≠ author` AND merger is human OR operator-attributed. Auto-merge
bots (`mergifyio[bot]`, `github-actions[bot]` for queued merges, etc.)
forward the merger bonus to the approving reviewer(s); split equally if
multiple humans approved.

### 6.4 Squash-merge attribution fix

Indexer detects squash commits (`single-parent commit on default branch
whose SHA matches the PR's merge_commit_sha and whose message ends with
`(#NNNN)`). These are skipped in the commit pass. Credit is attributed
via the merged-PR pass to `pr.user`, not to the committer of record.

### 6.5 Pacing and the draft queue

**Goal**: honest contributors can ship as much as they want without losing
work, but burst-grinding for points is naturally bounded. Two coordinated
mechanisms — a soft scoring cap with carry-forward, and a draft auto-review
queue — implement this without auto-converting any PR to a draft against
the contributor's wishes. The mechanism is non-intrusive: GitShipt informs,
contributors decide.

#### 6.5.1 Per-window scoring cap (soft, carry-forward)

`scoringConfig.perWindowPrCap` (default 10) is the max number of merged PRs
per contributor per period that earn full credit toward score. Behavior:

- Merged PRs sorted by `merged_at`. The first `perWindowPrCap` earn full
  credit. Subsequent merged PRs **score 0 this period** but their counts
  are still recorded for stats and CI/alignment signals.
- PRs that merge in a *future* period earn full credit in that period,
  per the normal rules. There is no double-counting and no permanent
  penalty: a contributor who shipped 25 PRs but the cap was 10 sees 10
  score now and 15 still-mergeable, deferred work that will score in the
  periods they merge.
- The carry-forward is the burnout-safety property: a contributor who
  pushed 12 PRs then took a 30-day break still earns from those 2 over-cap
  PRs in whatever period they get merged.

#### 6.5.2 The draft queue (opt-in)

Contributors who know they're over-cap have three ways to defer cleanly:

1. **Leave the PR open**, let it merge whenever, score later.
2. **Convert to draft** to explicitly defer maintainer review.
3. **Close it themselves** if no longer relevant.

For drafts: the `processDraftQueue` workflow (cron every 6h) auto-reviews
drafts older than `draftAutoReviewDelayHours` (default 24h) and routes each
to one of two outcomes:

- **Elevate** — un-draft via the App, post `gitshipt-bot` comment requesting
  maintainer review, audit-log. PR proceeds normally from there.
- **No-penalty close** — close with label `gitshipt:no-penalty-close`,
  post `gitshipt-bot` comment explaining why, audit-log. The closure does
  NOT count toward the `closedWithoutMerge` alignment penalty (§8.1).

Auto-review heuristics (cheap, no LLM):

- `mergeable === true` per GitHub API
- No file conflicts with PRs merged since the draft was created
- Diff has substance (>5 non-whitespace lines; not just lockfile/dist)
- Touches `priorityFileAreas` **OR** has `Fixes #N` to an open issue
  **OR** has a maintainer label/review
- Author has activity (push or comment) in last 7 days

All five → elevate. Any failure → no-penalty close.

#### 6.5.3 Non-intrusive enforcement

GitShipt does **not** auto-convert any PR to draft. Instead, when a
contributor's first over-cap PR is created in a window, `gitshipt-bot`
posts a single comment on that PR (and any subsequent over-cap PRs in the
same window):

> You're over your scoring cap for this period (11/10). This PR will not
> affect your score this period. Options:
> 1. Leave as-is — it scores in whatever period it merges.
> 2. Convert to draft — defer review explicitly; will be auto-reviewed
>    after 24h.
> 3. Close it yourself — if it's no longer relevant.
>
> Your work is welcome. The cap exists to prevent burst-spamming for
> points, not to discourage contribution.

A check named `gitshipt/score-status` shows the cap state on the PR.
**Informational only** — always passes, never blocks CI. Status text
reflects current state ("11/10 — defers to next period"; "elevated by
auto-review"; "no-penalty closed").

#### 6.5.4 Edge case decisions

- **Stale auto-elevated PR**: an elevated PR that sits unreviewed by a
  maintainer for 14 days is auto-closed with `gitshipt:stale-no-penalty`
  (same alignment treatment as no-penalty close). At 7 days, `gitshipt-bot`
  posts a reminder ping on the PR ("auto-elevated 7 days ago, awaiting
  maintainer; will be closed at 14 days if no action"). One full window
  for active projects to engage; sleepy projects get notified.
- **Maintainer manual review beats auto-review**. Maintainer approve →
  un-draft immediately, score under normal rules. Maintainer
  request-changes → pause the auto-review timer until the next push from
  the contributor (timer resets on push).
- **`gitshipt:wip` opt-out label**. Contributor can apply to pause the
  auto-review timer for up to 30 days (or one full window, whichever
  longer). After expiry, auto-review runs.
- **Re-elevation and gaming attempts are NOT defended algorithmically.**
  See §6.6 — the penalty system is the catch-at-PR mechanism. If a
  contributor games auto-review, the maintainer flags them with
  `/gitshipt flag` and the penalty handles it. Trying to outsmart gamers
  in auto-review code creates surface area for false positives and
  produces an arms race we will lose. We trust the social layer.

#### 6.5.5 New workflow: `processDraftQueue`

`apps/web/workflows/processDraftQueue.ts`. Cron: every 6h. Per project:

1. List open drafts on default repo via Octokit, filter to age >
   `draftAutoReviewDelayHours` (and not labeled `gitshipt:wip`).
2. For each, run §6.5.2 heuristics; route to elevate or no-penalty close.
3. List elevated PRs from `pendingAdminAction`-equivalent table (new:
   `pendingDraftReviews`) where elevation age > 7 days; if 7d → ping
   reminder, if 14d → stale-close.
4. Audit log + revalidate caches.

Idempotency: per-PR-per-action key prevents repeat actions on the same
review pass.

### 6.6 Penalty system — catch at the PR

**Philosophy**: maintainers know their repo's gaming patterns better than any
heuristic ever will. Don't try to outsmart gamers algorithmically. Give
maintainers tools to flag bad actors at the PR; make their judgment
economically binding. Algorithm handles the 80%; maintainers handle the 15%;
accept the 5%.

#### 6.6.1 Slash commands

Parsed from PR comments (and review comments) by a webhook handler at
`/api/webhooks/github/issue_comment`. Comment author's permission is verified
against the repo via `repos.getCollaboratorPermission` at the time of the
command.

| Command | Effect | Required perm |
|---|---|---|
| `/gitshipt flag` | Issue **yellow card** to PR author. Alignment ×0.5 for 30 days. | triage+ |
| `/gitshipt ban` | Issue **red card**. No earnings on this project for 90 days; alignment forced to 0 for the rest of the current window. | triage+ |
| `/gitshipt clear` | Clear an active yellow or red on the PR author. | triage+ |
| `/gitshipt no-penalty-close` | Close PR with no alignment hit. | triage+ |
| `/gitshipt confirm-quality` | Mark a review or PR as substantive even if heuristics doubt it. | triage+ |
| `/gitshipt verify-community @user` | Mark contributor as community-verified (see §6.7). | triage+ |
| `/gitshipt unverify-community @user` | Remove the community-verified flag. | triage+ |

Repeat-red within 12 months auto-escalates to **black card** (permaban).
Black cards are not issued by command; they're a system-recognized
escalation. Lifting a black card requires two-super-admin cosign.

CI workflows can issue yellow/red via the `penalty_issue` CI event (§10);
black cards cannot be issued by CI.

#### 6.6.2 Schema

New table:

```ts
contributor_penalties (
  id text pk,
  contributor_id text not null fk,
  project_id text not null fk,
  level text not null check (level in ('yellow','red','black')),
  reason text not null,
  evidence_pr_url text,                    // nullable for human-issued
  evidence_url text,                       // CI run URL — required when issued_by = 'ci_workflow'
  issued_by text not null check (issued_by in ('human_maintainer','ci_workflow')),
  issued_by_user_id text,                  // gh user id; null when ci-issued
  issued_at timestamp not null default now(),
  expires_at timestamp not null,           // computed: 30d for yellow, 90d for red, never for black
  cleared_at timestamp,
  cleared_by_user_id text
)
-- index on (contributor_id, project_id, expires_at, cleared_at)
-- index on (project_id, level, expires_at)
```

#### 6.6.3 Enforcement

Checked at the moment of compute/dispatch, never stored on score:

- **Yellow active**: alignment ×0.5 in `computeAlignmentFactor`.
- **Red active**: payout dispatcher skips this contributor; alignment forced
  to 0 for stats display.
- **Black active**: payout skipped; project-owner dashboard shows banner
  asking whether to keep the contributor visible at all.

A penalty is "active" iff `expires_at > now()` AND `cleared_at IS NULL`.

#### 6.6.4 Visibility

- **PR check** `gitshipt/penalty-status` on every PR the contributor opens
  shows current state. Informational only — never blocks CI.
- **Contributor dashboard** lists active penalties with reasons, evidence
  URLs, and the maintainer who issued them. Appeal path: DM the project
  owner.
- **shipshape.md** (per-project) publishes the slash commands and the
  consequences. Contributors must be able to read the rules.

#### 6.6.5 Audit + idempotency

Every issue/clear writes a `audit_log` entry with:
`{ projectId, contributorId, action, level, issuedBy, evidenceUrl, prUrl, ts }`.

Slash commands are idempotent on `(projectId, contributorId, prNumber, action)`
within a 5-minute window — repeated `/gitshipt flag` from the same PR is
a no-op.

CI-issued penalties are rate-limited at the project level: if more than 10%
of active contributors are flagged by CI in a window, further CI penalty
events return `429 Rate Limited` and notify the project owner. Defends
against runaway CI rules.

### 6.7 Community verification — advised, not enforced

**Philosophy**: GitShipt does not run, host, or verify community channels.
But algorithm can't tell humans from Sybil farms; voice/video calls can.
Owners run their own community for due diligence; we surface the links and
provide an optional payout-threshold gate.

#### 6.7.1 Schema

```ts
// projects
communityLinks: jsonb {
  discord?: { inviteUrl: string, verificationPolicy?: string };
  telegram?: { inviteUrl: string };
  x?: { handle: string };
  custom?: Array<{ label: string; url: string }>;
}

// contributors
communityVerified: boolean default false
communityVerifiedBy: text                  // gh user id who marked, nullable
communityVerifiedAt: timestamp             // nullable
```

#### 6.7.2 Optional payout gate

Off by default. Per-project:

```ts
projects.payoutConfig.communityVerifiedThresholdLamports: number | null
```

If set: contributors whose period payout exceeds the threshold must have
`communityVerified = true` to actually receive payout. Below threshold:
paid normally. Lets owners require Discord-call verification for bigger
fee-shares without gating tiny ones.

Unverified contributors above threshold see their unpaid earnings held in
a project-level escrow (`pendingCommunityVerification`) until either they
get verified or the project owner waives the threshold.

#### 6.7.3 shipshape.md disclosure

shipshape gains a "Community" section that publishes:
- Each declared community link
- Whether community verification is required above any payout threshold
- Plain-language note: GitShipt does not run, host, or verify these
  channels — it's the project's own due diligence

Sample render:

> ## Community
>
> Maintainers do voice/video verification in our Discord at `<invite>`.
> Required if your period earnings exceed 0.5 SOL; optional below.
> GitShipt does not run or enforce this — it's our own due diligence.

## 7. Indexer v1

### 7.1 Reviews populated

For each merged PR in window:
- `octokit.rest.pulls.listReviews({ owner, repo, pull_number })` — paginate.
- Filter to reviews where `state ∈ {APPROVED, CHANGES_REQUESTED}` and
  `user.id !== pr.user.id` (no self-review).
- Per reviewer:
  - `reviews += 1`
  - If review meets `substantiveReviewFloor` (body ≥ 200 chars OR ≥ 1
    inline review comment via `pulls.listReviewComments`),
    `reviewSubstantiveScore += 1.0` (else `+= 0.3`).
  - If reviewer's earliest review was `CHANGES_REQUESTED` and a later review
    is `APPROVED`, `reviewSubstantiveScore += 0.5` bonus (the change-request
    delta — capturing real iteration work).

### 7.2 Co-authored-by parsing

For each commit in window: parse trailers via case-insensitive match on
`/^Co-authored-by:\s*(.+?)\s*<(.+?)>$/m` in the commit message body.
For each match, look up the GitHub user by `email` (Octokit `users.getByEmail`
or noreply email pattern parsing for `<id>+<login>@users.noreply.github.com`).
On hit:
- `coAuthored += 1` for the co-author
- The primary author still gets `commits += 1`

### 7.3 Trivial-commit filter

Per `repos.getCommit`, inspect `files[]`:
- All files match `glob: ['**/*.lock', 'package-lock.json', 'bun.lockb',
  'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'dist/**', 'build/**',
  '.next/**', 'coverage/**']` → skip.
- All file diffs are whitespace-only (regex test on `patch` string after
  stripping `+` / `-` line markers; if remaining content is whitespace) → skip.

This adds one `getCommit` call per commit; bounded by `perPrCommitCap`.
Cache aggressively in `lib/github/http-cache.ts`.

### 7.4 Per-PR commit aggregation

Replace the current "1 commit on default branch = 1 commit credit" with:
- For each merged PR: count commits on the PR (via
  `pulls.listCommits({ owner, repo, pull_number })`), cap at
  `perPrCommitCap`, attribute to `pr.user`.
- Default-branch commits NOT associated with a merged PR (drive-by direct
  pushes by maintainers) get the legacy 1:1 treatment, capped at
  `drive_by_allowance` (default 3) per contributor per window.

## 8. Alignment v1

### 8.1 Computation

Per contributor per period:

```
alignment_factor = clamp(0.0, 1.0, baseline + Σ(signal_value × signal_weight))
```

`baseline = 0.5`. Signal values:
- Per merged PR with `Fixes #N` to an open issue: `linkedOpenIssue` (default +0.30)
- Per merged PR with priority-label issue link: `priorityLabelMatch` (+0.20)
- Per merged PR touching only `priorityFileAreas` globs: `fileAreaMatch` (+0.20)
- Per merged PR responding to a maintainer-requested-change review:
  `maintainerRequested` (+0.30)
- Per closed-without-merge PR in window: `closedWithoutMerge` (−0.40)
- Per merged PR touching `nonGoalFileAreas` globs: `nonGoalAreaTouch` (−0.30)
- CI signals (per-PR averages, normalized):
  - First-push test pass rate ≥ 80%: `ciFirstPushPass` (+0.10)
  - Net coverage positive: `ciCoveragePositive` (+0.10)
  - Net coverage negative: `ciCoverageNegative` (−0.10)
  - Per `brokeMain` event: `ciBrokeMain` (−0.30)

Each signal value is averaged over the contributor's merged PRs in the
window (so a single bad PR doesn't tank a 50-PR contributor).

**No-penalty closure exception.** Per §6.5, PRs closed with
`gitshipt:no-penalty-close` or `gitshipt:stale-no-penalty` labels are
**excluded** from the `closedWithoutMerge` denominator and signal sum.
Auto-review is the system's "this didn't work out" path; using it should
not punish the contributor.

**Auto-elevation merge bonus.** PRs that were elevated by auto-review and
subsequently merged add `+0.05` to alignment in the period of merge. Small
positive recognition that deferred work proved valuable when it landed.

### 8.2 Application — asymmetric multiplier (mode: "asymmetric")

```
if alignment_factor < floor:        payout *= 0.5
elif alignment_factor > ceiling:    payout *= 1.2
else:                                payout *= 1.0
```

Defaults: floor 0.3, ceiling 0.7. Multipliers are owner-configurable.
Other modes (`informational`, `multiplicative`, `gate`) defined in the
schema for future use; v1 ships with `asymmetric` as default.

### 8.3 Fallback

If `alignmentConfig.enabled === false` OR the project has fewer than 5
labeled issues in its tracker (insufficient signal): mode forced to
`informational` (no payout effect; alignment shown on dashboard only).

## 9. Shipshape generator

### 9.1 Inputs

`generateShipshape(projectId): string` reads:
- `projects` row (name, repo, token symbol, fee-share %)
- `projects.scoringConfig` (active formula + weights)
- `projects.alignmentConfig` (alignment policy)
- `projects.agentRoutingPolicy` (attribution rules)

Pure function over the project state. No live activity reads; that's logbook.

### 9.2 Output sections (in shipshape.md)

```
1. Project header (name, repo, token, fee-share %, payout cadence,
   leaderboard URL)
2. Active scoring rubric (live formula + weights)
3. What "substantive" means here (from substantiveReviewFloor)
4. Attribution rules (from agentRoutingPolicy)
5. Repo norms (PR template hint, conventional-commits expectation,
   Co-authored-by guidance)
6. Anti-gaming preflight (per-PR cap, trivial-commit filter, decay)
7. Alignment definitions (priority labels, priority/non-goal areas,
   issue-link policy, the asymmetric multiplier band)
8. CI integration (the gitshipt/report-action interface — what events
   to emit and how they affect alignment)
9. Pacing and the draft queue (per-window cap, carry-forward,
   gitshipt-bot guidance, gitshipt:wip opt-out, no-penalty closure path)
```

### 9.3 Logbook (separate generator)

`generateLogbook(projectId): string` reads:
- Latest 7 contributors by score (top 5 displayed)
- `lastIncrementalSyncAt` from `ghIndexerState`
- 5 most-recently-modified file areas (from indexed commits)
- 3 open issues with `priorityLabels` matching alignment config

Cached at `cacheLife("live")` (60s revalidate).

## 10. CI ingest endpoint

### 10.1 Route

`POST /api/projects/[projectId]/ci-event`

### 10.2 Auth

**Primary: GitHub Actions OIDC.**

The reusable action mints an OIDC token from the workflow run, scoped to the
GitShipt audience. Request includes `Authorization: Bearer <jwt>`. GitShipt
verifies:
- JWT signature against GitHub's JWKS (`token.actions.githubusercontent.com/.well-known/jwks`)
- `aud === "gitshipt"`
- `repository === project.ghOwner/project.ghRepo`
- `iat` within last 10 minutes
- `actor` (GitHub user) is recorded as the event's submitter

**Fallback: HMAC.** For projects on non-GitHub-Actions CI (CircleCI, custom
runners, etc.), an HMAC-signed request:
- `X-GitShipt-Signature: sha256=<hex>` over `${timestamp}.${body}`
- HMAC key per project, generated at install time, displayed once
- `X-GitShipt-Timestamp` rejected if > 5 minutes old

### 10.3 Event types

```ts
type CiEvent =
  | { type: "test_result";    prNumber: number; sha: string;
      passed: boolean; retries: number; durationMs: number }
  | { type: "coverage_delta"; prNumber: number; sha: string;
      deltaBp: number; baseSha?: string }
  | { type: "bundle_delta";   prNumber: number; sha: string;
      deltaBytes: number; baseSha?: string }
  | { type: "perf_delta";     prNumber: number; sha: string;
      metric: string; deltaBp: number;
      direction: "lower-is-better" | "higher-is-better" }
  | { type: "penalty_issue";  prNumber: number; sha: string;       // §6.6
      level: "yellow" | "red";          // CI cannot issue black
      reason: string;                    // ≤200 char human-readable
      evidenceUrl: string }              // REQUIRED — CI run URL
  | { type: "penalty_clear";                                       // §6.6
      contributorGhUserId: string;
      reason: string }
```

All events Zod-validated. Idempotency key = `(projectId, prNumber, sha, type)`.
Rejected events still emit an audit log entry.

### 10.4 Effect

CI events feed `contributors.inputs.ci.*` aggregates per period for the PR's
author. Aggregates feed alignment computation per §8.1. `penalty_issue` and
`penalty_clear` write to `contributor_penalties` per §6.6 (with rate limit:
> 10% of active contributors flagged in a window pauses further CI penalty
events and notifies the project owner).

## 11. Existing-project policy (option b)

- All projects with `formulaVersion: "v0"` and no `shipshape.md` committed
  on default branch enter a 14-day migration window starting at PR 2 deploy.
- During the window, payouts continue under v0 scoring.
- 7 days in, in-app + email notification: "install shipshape within 7 days".
- 14 days in, projects without shipshape committed:
  - `paused = true` with `pausedReason = "shipshape_not_installed"`
  - Workflows skip them
  - Owner sees a banner with "Install shipshape" CTA on dashboard
- Owner can clear pause by completing install at any time.

`MIGRATION_WINDOW_DAYS = 14` is configurable in `platformConfig`.

## 12. Launch gate (PR 2 — referenced for spine compatibility)

State machine on `projects.launchState`:

```
                     [user creates project]
                              ↓
                      pending_install
                              ↓ (user installs GitShipt App + shipshape PR opens)
                      awaiting_pr_merge
                              ↓ (install PR merged, webhook fires)
                       ready_to_launch
                              ↓ (user submits launch + admin re-verified + Bags tx)
                          launched
```

At every transition the launching user's GitHub `admin` permission on the
target repo is re-verified live. Permission can be lost between transitions;
the gate fails closed.

## 13. Format adapters (PR 2)

Single source of truth: `shipshape.md`. Adapters serialize a subset:

- `CLAUDE.md` — full shipshape with `@AGENTS.md` and `@SPEC.md` cross-refs
- `.cursor/rules/gitshipt.md` — Cursor-rules format with frontmatter
- `.github/copilot-instructions.md` — flat instructions, no frontmatter

All three reference the canonical live URL
`https://gitshipt.com/r/[org]/[repo]/shipshape.md` so they don't go stale.

## 14. Dashboard configurator (PR 3 — referenced for completeness)

`dashboard/projects/[id]/agents/page.tsx`:
- Alignment policy editor (priority labels picker from project's labels,
  glob patterns for file areas, issue-link policy radio)
- Agent routing policy editor (default policy, per-bot bindings with
  cosign for team repos)
- Runbook preview (renders current `shipshape.md` + `logbook.md`)
- "Install runbook" / "Update runbook" buttons

## 15. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Projects gaming alignment by self-labeling everything "P0" | Alignment config changes require audit log; large jumps (>30% of issues relabeled in <24h) trigger fraud-watch flag in admin console |
| GitHub API rate limits from per-PR `pulls.listReviews` | Aggressive caching in `http-cache.ts`; OAuth installation tokens have 5k req/hr per installation |
| Trivial-commit filter false-positives (e.g., legitimate dist/ commits in build-output repos) | Filter disable per project (`trivialCommitFilter: false`) |
| OIDC verification adds latency to CI ingest | JWKS cached for 24h; verification ~5ms per request |
| Co-authored-by spam (claim every commit as co-author) | Co-author credit is `+= 1` per *unique* commit, deduped by SHA; co-author share capped by `coAuthorSplitRatio` |
| Existing project owners caught off-guard by 14-day window | Multiple notifications (in-app, email, dashboard banner); explicit unpause is one-click |

## 16. Test plan

- **Unit**: every pure function in `lib/scoring/v1.ts`, `lib/scoring/alignment.ts`,
  `lib/agents/shipshape.ts`, `lib/agents/logbook.ts`, trivial-commit detection,
  squash-merge detection, OIDC token verification.
- **Integration**: indexer round-trip with mocked Octokit returning realistic
  PR/review/commit fixtures; CI ingest endpoint round-trip with both auth modes;
  alignment computation end-to-end given fixture project state.
- **E2E**: shipshape.md and logbook.md routes return correct content for a
  seeded project; CI ingest happy path with self-signed OIDC mock.
- **Property**: alignment factor always within [0.0, 1.0]; score monotonically
  non-decreasing in any single input given non-negative weights.

## 17. Out-of-scope (explicit non-goals for this branch)

### 17.1 Deferred capabilities (will ship later)

- Full agent routing enforcement (v2)
- Substance-checking AI reviews — does the comment reference real diff
  symbols, do suggestions compile (v2)
- The `gitshipt/report-action` repository itself (PR 2)
- Dashboard configurator UI (PR 3)
- Hosted AI review service (not on roadmap)
- Cross-repo / monorepo aggregation (v3)
- Non-GitHub source forges (GitLab, Codeberg) — v3 minimum

### 17.2 Acknowledged limitations — the "oh well" list

These attacks exist, are not solvable algorithmically without
cross-platform identity or KYC, and are accepted v1 limitations. Mitigated
by the social layer (penalty system §6.6, community verification §6.7,
operator-share cap, audit log, peer override) but not eliminated:

- **Maintainer-author collusion via alt accounts.** A maintainer with an
  alt can author + self-approve + self-merge. Mitigated by operator-share
  cap (30%), audit log, peer override, and ultimately reputation pressure.
  Real fix requires cross-account identity binding (v2+).
- **Cross-repo single-human arbitrage.** One person who's admin on N
  GitShipt-using repos can scale per-project caps by N. Same root cause,
  same v2 fix.
- **Project owners writing biased CI rules to flag honest contributors.**
  Maintainer-side gaming. Mitigated by mandatory `evidenceUrl` on
  CI-issued penalties, peer-maintainer override (`/gitshipt clear`), and
  contributor's right to walk to a different repo.
- **Community channels GitShipt does not run.** §6.7 advises projects
  link Discord/Telegram/X for human verification, but GitShipt does not
  host, moderate, or attest to anything that happens there. False
  verification by a colluding maintainer in a Discord call is the same
  Sybil problem as alt accounts.

These are documented in `SPEC.md` non-goals so the system is honest about
what it cannot enforce.

## 18. Open questions left for implementation time

- **Default substantive-review thresholds.** Doc proposes 200 chars / 1 anchored
  comment. Will tune after seeing GitShipt's own contributor distribution.
- **OIDC audience string.** Proposed `"gitshipt"`; might switch to
  `"https://gitshipt.com"` for URI convention compliance.
- **`logbook.md` cache profile.** Proposed `"live"` (60s); may bump to
  `"browse"` (120s) if rendering cost is high.
- **Bundle delta unit.** Bytes, gzipped or raw? Defaulting to raw with an
  optional `gzipped: bool` field on the event.

These don't block the design; flagging so they're not forgotten.

---

## Approval gate

Implementation does not start until this doc is reviewed. After approval,
implementation lands as a series of commits on this branch in the order:

1. Schema migration (incl. perWindowPrCap / draftQueueEnabled fields,
   contributor_penalties table, communityLinks/communityVerified columns,
   pendingDraftReviews table)
2. Scoring v1 + pacing cap logic + tests
3. Indexer v1 (incl. head-SHA check on review iteration bonus,
   linkedOpenIssue author rule, co-author noreply verification) + tests
4. Alignment v1 (incl. no-penalty closure exception, penalty-active
   multipliers) + tests
5. Penalty system + slash-command webhook handler + tests
6. Community verification schema + payout gate enforcement + tests
7. Shipshape + logbook generators (incl. §9 Pacing, §10 Community,
   §11 Penalty rules) + tests
8. Public routes + tests
9. CI ingest endpoint (incl. penalty_issue / penalty_clear) + tests
10. processDraftQueue workflow + auto-review heuristics + tests
11. Public docs honesty fix
12. GitShipt's own `shipshape.md` at repo root
13. GitShipt's own `.github/workflows/gitshipt-report.yml`

Each commit passes typecheck and tests independently.
