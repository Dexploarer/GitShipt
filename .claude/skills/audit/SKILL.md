---
name: audit
description: Production-readiness audit of the current branch. Reports P0/P1 findings against SPEC.md invariants, observability, CI, and e2e coverage WITHOUT making changes until the user approves a fix plan. Use when the user says "audit", "production-readiness", "harden", or asks for a pre-ship review of the branch.
---

# /audit — production-readiness audit

You are running a read-only audit. **Do not edit files** until the user approves
a fix plan in chat. Audit, report, plan, then wait.

## Phase 0 — load the contract

Read these files in full before scoring anything:

1. `SPEC.md` — frozen invariants and non-goals
2. `CLAUDE.md` — repo guidance
3. `AGENTS.md` — stack pins and authoring rules

Anything you flag must reference a specific invariant from `SPEC.md` or a
specific rule from `CLAUDE.md` / `AGENTS.md`. Do not invent standards.

## Phase 1 — invariant sweep (P0)

For each invariant in `SPEC.md`, search the diff (or current branch state) for
violations. Use `Grep` and `Read` — do not edit.

P0 = ships now is unsafe. Common P0 patterns to look for:

- Raw hex literals in components (`#[0-9a-fA-F]{3,8}` outside `globals.css`,
  `packages/ui/`, and theme tokens).
- `useTheme()` calls outside `theme-toggle.tsx`.
- `proxy.ts` doing anything other than redirects + CSP nonce minting.
- Mutations missing any link in: session revalidation → `requirePermission` →
  Zod validation → idempotency-key → audit log → cache-tag revalidation.
- External API calls inside workflow steps without
  `getStepMetadata().stepId` as idempotency key.
- Sensitive env vars (`*_KEY`, `*_SECRET`, `*KEYPAIR`) referenced from
  client-side code or non-Sensitive Vercel config.
- SPL token logic, multi-token branches, or any non-SOL payout path.
- Grace/claim window logic, custom Incorporation flows, or anything in
  `SPEC.md` non-goals.
- Cold treasury keypairs in Vercel-readable env.

## Phase 2 — production hardness (P1)

P1 = ships now is risky but not broken. Check:

- Observability — Sentry init, error boundaries on each route realm, structured
  logging on workflow steps and external API calls.
- Rate limiting — `lib/rate-limit.ts` applied to public mutation routes.
- CI coverage — every script in `package.json` referenced by `.github/workflows/`.
- E2E coverage for new mutation paths.
- Theme tokens — run `bun run theme:lint` mentally; flag drift.
- `cacheLife` profile correctness on `'use cache'` reads (must match
  `CACHE_SECONDS` in `lib/cache.ts`).
- Stub-safe fallbacks present on every new external client (Bags, Helius,
  GitHub, payout keypair).

## Phase 3 — report

Output a single markdown report with this exact shape. No prose preamble.

```
## Audit — <branch>

### P0 (block ship)
- [file:line] <one-line finding> — violates <SPEC.md invariant or CLAUDE.md rule>
- ...

### P1 (fix before ramp)
- [file:line] <one-line finding> — <why it matters>
- ...

### Clean
- <invariant or area you verified is fine — keep this list short, only mention non-obvious wins>

### Proposed fix plan
1. <numbered steps with files to touch>
2. ...
```

Use `[file.ts:42](apps/web/path/file.ts#L42)` markdown link syntax for every
finding so the user can click through.

## Phase 4 — STOP

After the report, say one line: "Approve the fix plan and I'll execute, or
edit the list and tell me which items to drop."

**Do not start editing.** The user approves before code moves.

## Anti-patterns for this skill

- Do not fix things mid-audit. Audit first, fix second.
- Do not flag style or refactor opportunities unless they violate an invariant.
  This is a production-readiness audit, not a code review.
- Do not invent invariants. If `SPEC.md` doesn't forbid it and `CLAUDE.md`
  doesn't require it, it's not a finding.
- Do not produce a >2-page report. Tight, actionable, link-prefixed bullets.
