<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# GitShipt — agent context

You are working in **GitShipt**, a Solana token launchpad that pays out trading fees to a GitHub repo's top contributors daily. Read these two files first; they bind every decision:

1. **`DESIGN.md`** — Google Labs DESIGN.md spec defining the cypherpunk-dark visual system. Two palettes (dark canonical + light mirror).
2. **`gitshipt-prd.md`** — full product spec: architecture, data model, Bags integration, security model, page tree, permissions matrix.

If anything in these files conflicts with your training data, the file wins.

## Stack pins (verified April 2026)

- **Runtime**: Bun 1.3.13 workspace monorepo, Next.js 16.2 (App Router, Server Actions, Turbopack, React Compiler), React 19.2, Node 22.
- **Bun HTTP/3**: Bun's `h3: true` / `protocol: "http3"` APIs landed after the 1.3.13 stable release. Use canary only for local experiments; keep production Next/Vercel and money-moving paths on stable Bun until Bun publishes HTTP/3 in a stable release.
- **DB**: Neon Postgres via Vercel Marketplace. The app accepts `DATABASE_URL` / `DATABASE_URL_UNPOOLED` from the Neon integration, plus `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` aliases for generic Postgres compatibility. Runtime DB access uses Drizzle; Neon URLs use the Neon serverless driver path and generic Postgres uses `postgres-js`.
- **Cache / nonces / rate-limit**: Upstash Redis.
- **Background**: Vercel Workflows (`workflow` package, `'use workflow'` / `'use step'` directives). **Step idempotency is NOT automatic** — pass `getStepMetadata().stepId` as the key for any external API call.
- **Auth**: `better-auth` with GitHub OAuth + custom SIWS plugin (`@phantom/sign-in-with-solana`).
- **Solana**: `@solana/web3.js@^1.98.x` (v1 line; do not use `@solana/kit`).
- **Bags**: `@bagsfm/bags-sdk` Token Launch v2. Claim namespace is `sdk.fee.*` (not `sdk.feeClaim.*`).
- **UI**: Tailwind v4 (`@theme inline`, no `tailwind.config.js`) + `@repo/ui` shadcn-style primitives + Lucide + Geist / Geist Mono.
- **Theming**: `next-themes` with `attribute="data-theme"`, `defaultTheme="system"`, `disableTransitionOnChange`, `suppressHydrationWarning` on `<html>`.

## Authoring rules

- **No raw hex in components.** Ever. Use design tokens via Tailwind utilities: `bg-surface`, `text-fg`, `text-fg-secondary`, `border-border-strong`, `text-rank-gold`. Both palettes resolve automatically.
- **Mono for money.** Every SOL amount, USD price, score, BPS value, timestamp, and tx signature uses `text-mono-md` or `text-mono-sm`. Body copy is never mono.
- **One primary per viewport.** Stacking primary-green buttons + green sparklines + green pills in the same fold is the most common drift. Pick one.
- **Components never call `useTheme()`** except `theme-toggle.tsx`. Theming is automatic via CSS variables.
- **`proxy.ts` is redirects only.** Auth must be revalidated inside every protected route handler and Server Component (CVE-2025-29927 mitigation).
- **TypeScript strict.** `noUncheckedIndexedAccess` is on. No `any` outside justified, commented type holes.
- **Every Server Action and route that mutates state** must (a) revalidate the session, (b) check permissions via `requirePermission`, (c) write an audit log entry on success, (d) accept and respect `Idempotency-Key`.
- **External API responses are Zod-validated.** Never trust shape from Bags, GitHub, or Helius.
- **Sensitive env vars** (`*_KEY`, `*_SECRET`, `*KEYPAIR`) must be flagged Sensitive in Vercel (post-April-2026 incident). Cold treasury keys never enter Vercel.

## File-tree quick map

- `apps/web/app/` — App Router. `(public)`, `(auth)`, `dashboard/` (project owner), `admin/` (super-admin, separate session realm).
- `apps/web/workflows/` — Vercel Workflows. One file per workflow. `steps/` for shared step helpers.
- `apps/web/components/` — app-owned chrome/features: public shell, sidebar, launch wizard, admin, wallet, shared app components.
- `apps/web/lib/` — `auth/` (better-auth + SIWS + permissions), `bags/` (typed client, stub-flippable), `github/` (Octokit App), `solana/`, `scoring/`, `redis.ts`, `rate-limit.ts`, `idempotency.ts`, `audit.ts`.
- `apps/web/db/` — Drizzle: `schema/` (one file per concern), `migrations/`, `index.ts` (exports `dbHttp` + `dbPool`).
- `packages/ui/` — shared UI primitive barrel imported as `@repo/ui`.
- `packages/lib/` — pure utility barrel imported as `@repo/lib`.
- `packages/shared/` — Zod schemas, types, constants reused on client + server, imported as `@repo/shared`.
- `apps/web/proxy.ts` — Next 16 file (renamed from `middleware.ts`). Redirects only.

## Day-1 status (April 25, 2026)

Foundation in progress: scaffold + design system + DB schema + auth shells + first workflow. See plan at `~/.claude/plans/you-are-building-gitshipt-moonlit-wand.md`.

## When you hit a credential blocker

Stop and tell the user exactly what env var you need in one sentence. Do not invent secrets. External clients (`apps/web/lib/bags/`, `apps/web/lib/solana/`, `apps/web/lib/github/`) ship with stub fallbacks — flipping to live is one env-presence check per service.

<claude-mem-context>
# Memory Context

# [gitbags] recent context, 2026-04-28 8:01pm CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (23,586t read) | 2,120,477t work | 99% savings

### Apr 28, 2026
1798 6:29p ✅ gitbags-prd.md + vercel.json Doc Pass — Neon Terminology, Env Var Canonicalization, Missing Cron Added
1806 6:34p 🔵 GitBags Post-Upgrade Quality Gate — All Green (S133 Final Verification)
1807 6:37p 🔵 GitBags Working Tree — Full Multi-Session Diff Before Structured Commit
1808 " ✅ GitBags Commit 5ceb13a — "Update Bun runtime and docs"
1809 " 🔴 Zsh Glob Expansion Fails on [...all] Bracket Pattern in git add
1810 " ✅ GitBags Commit a12326d — "Harden runtime env and database setup"
1811 " 🔄 getTableRowCountsUncached — Single Parameterized Query Replaces Sequential pg_class Loop
1812 " 🟣 claimPartnerFees — Admin Cache Revalidation After Successful Settlement
1813 " 🔄 GitHub Health Ping in Admin Page — Moved to getCachedValue to Avoid Live Call Per Render
1814 6:40p ✅ GitBags Commit d6b932f — "Add fund reconciliation workflow"
1815 " ✅ GitBags Commit 807f949 — "Harden launch and payout money flows"
1816 " ✅ GitBags 5-Commit Push — Full Multi-Session Work Landed to main (dbaae13..6e75954)
1817 " 🟣 Cache-Control Hygiene — no-store-response.ts Utility + 6 Route Handler Patches
1818 6:52p 🔵 GitBags Money-Flow Security Audit — Four Critical Findings
1819 " ⚖️ Brand Rename: GitBags → GitShipt (Codex Task)
1822 " 🔵 GitBags → GitShipt Brand Rename — Full Occurrence Map (425 lines)
1824 6:53p ✅ GitBags → GitShipt Brand Rename — Bulk perl Substitution Across 65 Files
1826 " ✅ GitBags → GitShipt Brand Rename — Verified Complete, Internal Identifiers Confirmed Unchanged
1828 6:54p 🔴 Brand Rename Edge-Case Fixes — Apostrophe Corruption, Demo Email, Token Symbol
1833 6:55p ✅ Token Symbol Fallback + Demo Mint Address Updated to GitShipt Brand
1835 " ✅ GitBags → GitShipt Brand Rename — Final Verification Pass Complete
1837 6:56p 🔴 Brand Rename Cleanup — Redis Test Fixture Revert + AGENTS.md Bun Version Correction
1841 6:57p ✅ GitBags → GitShipt Brand Rename — Definitive Completion Verified
1844 6:58p ✅ Full "gitbags" → "gitshipt" Rename Extended to Internal Identifiers + PRD File Renamed
1845 7:00p 🔵 GitShipt Brand Rename Quality Gate — All 100 Tests Pass
1846 7:01p 🔵 GitShipt Brand Rename — Pre-Commit Working Tree: 100 Modified + 1 Deleted + 1 Untracked
1854 7:17p ⚖️ GitShipt Full Repo Completeness Audit Initiated — Scale of 100
1855 " 🔵 GitShipt Repo — Comprehensive Production-Readiness Audit Initiated
1856 " 🔵 GitShipt Prior Audit History Found in MEMORY.md — Four Completed Audit Passes
1857 7:20p 🔵 GitShipt Full Repo Audit — Build/Test/Lint Baseline Results
1858 " 🔵 GitShipt Production Env Gap — 15 Required Variables Missing from Vercel
1859 " 🔵 GitShipt Route and Feature Completeness — All PRD Routes Present, Admin Fully Wired
1860 " 🔵 GitShipt Security Architecture Audit — RBAC, Idempotency, Webhook Auth Fully Implemented
1861 " 🔵 GitShipt Workflow Architecture Audit — 10 Vercel Workflows Fully Implemented with Redis Locks
1862 7:32p 🔵 GitShipt Money-Flow Security Audit — New Deep Review Initiated
1868 7:33p 🔵 GitShipt Payout Pipeline — Full 9-Step Architecture Map
1869 " 🔵 GitShipt Fund Reconciliation Architecture — Hot Wallet vs Liability Delta
1870 " 🔵 GitShipt Manual Reconciliation Sentinel Pattern — Cross-System Zero-Loss Guarantee
1871 " 🔵 GitShipt Launch Flow — Two-Phase Checkpoint Prevents Duplicate Initial Buy
1872 " 🔵 GitShipt Fee-Share Update Pipeline — Idempotent Per-Target-Hash Attempt Model
1873 7:36p 🔵 GitShipt DB Schema — Payout, Recipient, Fee-Share, and Project Tables Fully Mapped
1874 " 🔴 loadFrozenSnapshotsAwaitingPayout Was Missing Retry-Safe Payout Resume
1875 " 🔴 persistPayoutPlan Did Not Re-Reserve Claiming Status on Retry + markPayoutClaimed Status Check Widened
1876 " 🔴 markLaunchSubmissionPending Was Fire-and-Forget — Now Throws on Persist Failure + Pending Signature is Deterministic
1877 " 🟣 payout-helpers.test.ts — New Test for loadFrozenSnapshotsAwaitingPayout SQL Predicates
1890 7:48p 🔴 loadFrozenSnapshotsAwaitingPayout SQL — Crashed Payouts Never Retried
1891 " 🔴 persistPayoutPlan — Retry Path Did Not Re-Advance Status to 'claiming'
1892 " 🔴 markPayoutClaimed — Status Filter Widened to Accept 'pending' or 'claiming'
1893 " 🔴 markLaunchSubmissionPending — Fire-and-Forget DB Write + Non-Deterministic Sentinel
1894 " 🔵 GitShipt Money-Flow Audit — All Four P0/P1 Vulnerabilities Fixed and Verified

Access 2120k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
