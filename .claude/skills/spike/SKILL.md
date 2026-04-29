---
name: spike
description: Pre-flight architecture validator. Identifies the riskiest technical assumptions for an upcoming feature, prototypes each in /spikes/ as a minimal standalone script, and reports go/no-go with evidence — BEFORE the real implementation starts. Use whenever a task involves new bundler/runtime constraints (Cloudflare Workers, edge runtime), new auth flows (OAuth providers, GitHub App vs PAT), new external SDK integration, or any architectural choice that could hit a wall mid-implementation.
---

# /spike — pre-flight architecture validator

You are running a 10-minute architecture spike. Goal: kill late-stage reverts
by proving the riskiest assumptions in a throwaway sandbox **before** the real
feature is built.

## Phase 0 — confirm the upcoming work

Restate in 2-3 lines what feature/refactor the spike is for. If the user has
not said yet, ask once:

> Before I spike: what feature/refactor is this for? Any specific runtime
> (Workers, edge, Node) or external API constraint I should test?

Do not proceed without that.

## Phase 1 — name the 3 riskiest assumptions

List the top 3 technical assumptions that would cause a revert if wrong.
Examples (from past sessions in this repo):

- "Lazy-loading `postgres-driver.ts` works under the CJS bundler we ship to."
- "GitHub OAuth user token can list private org repos for an installed App."
- "Bun's HTTP/3 stable build supports our Vercel deployment surface."
- "`@solana/web3.js@1.98` v1 client tree-shakes correctly under Turbopack."

For each assumption: one sentence, plus what would break if it's wrong.

## Phase 2 — write minimal spikes

Create `/spikes/<short-name>/` directories, one per assumption. Each spike:

- Single file, <100 lines. No tests, no abstractions, no UI.
- Hits the **real** API/runtime/bundler — no mocks. If credentials are
  missing, stop and name the env var (don't invent secrets).
- Runs via `bun run /spikes/<name>/index.ts` or equivalent.
- Logs a single PASS/FAIL line at the end with evidence.

Add `/spikes/` to `.gitignore` if it isn't already (do not commit spikes).

## Phase 3 — execute and capture

Run each spike. Capture stdout/stderr verbatim. If a spike fails, **do not
silently fix it** — failure is the signal. Surface it.

## Phase 4 — report

Write `/spikes/SPIKE_REPORT.md` with this shape:

```
# Spike report — <feature name>

## Assumption 1: <one-line>
- Spike: /spikes/<name>/index.ts
- Result: PASS | FAIL
- Evidence: <2-3 lines from stdout, or the error>
- Recommendation: GO | NO-GO | ALTERNATIVE: <propose>

## Assumption 2: ...

## Assumption 3: ...

## Verdict
GO with: <combined recommendation>
```

Then output the report inline in chat as well so the user can act on it
without opening the file.

## Phase 5 — STOP

Say one line: "Spike complete. Approve verdict and I'll implement, or pick
an alternative architecture."

**Do not start the real feature.** The spike is the whole job.

## Anti-patterns

- Do not spike trivial assumptions ("does Postgres accept SELECT 1"). Spike
  things that have actually bitten this repo: bundler/runtime constraints,
  third-party auth flows, SDK behavior under edge cases, cross-package
  module resolution.
- Do not write production-quality code in spikes. They are throwaway.
- Do not commit spikes. They go in `/spikes/` which is gitignored.
- Do not let a passing spike validate scope. SPIKE != APPROVAL TO BUILD;
  the user still owns the go-decision.
