<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# GitBags — agent context

You are working in **GitBags**, a Solana token launchpad that pays out trading fees to a GitHub repo's top contributors daily. Read these two files first; they bind every decision:

1. **`DESIGN.md`** — Google Labs DESIGN.md spec defining the cypherpunk-dark visual system. Two palettes (dark canonical + light mirror).
2. **`gitbags-prd.md`** — full product spec: architecture, data model, Bags integration, security model, page tree, permissions matrix.

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

Foundation in progress: scaffold + design system + DB schema + auth shells + first workflow. See plan at `~/.claude/plans/you-are-building-gitbags-moonlit-wand.md`.

## When you hit a credential blocker

Stop and tell the user exactly what env var you need in one sentence. Do not invent secrets. External clients (`apps/web/lib/bags/`, `apps/web/lib/solana/`, `apps/web/lib/github/`) ship with stub fallbacks — flipping to live is one env-presence check per service.

<claude-mem-context>
# Memory Context

# [gitbags] recent context, 2026-04-28 6:35pm CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (23,411t read) | 1,654,440t work | 99% savings

### Apr 28, 2026
1724 3:32p 🟣 workflow-locks.ts — Redis Single-Flight Distributed Locks for All Cron Workflows
1725 " 🟣 Payout/Escrow Partial-Success Recovery — MANUAL_RECONCILIATION_ERROR Sentinel + Retry Loops
1726 " 🟣 read-through-cache.ts — Central Redis Read-Through Cache with BigInt/Date Serialization
1727 " 🟣 github/http-cache.ts — ETag Conditional-Fetch Layer for GitHub API Calls
1728 " 🔄 GitHub contributors.ts and users.ts — Octokit Removed, Migrated to ETag HTTP Cache
1732 5:16p 🔵 Solana Dev Skill Loaded for Money-Flow Security Audit
1733 5:17p 🔵 GitBags Money-Flow Audit — Working Tree Has In-Progress Fund Reconciliation System
1734 " 🔵 GitBags SPL Escrow Drain — Not Yet Implemented at v0
1735 " 🔵 GitBags Money-Flow Full File Inventory — Comprehensive Audit Surface
1736 " 🔵 GitBags PRD Money-Flow Contract — Authoritative Design Reference
1749 5:27p 🔵 GitBags Money-Flow Security Audit — Session S129 Initiated
1750 5:28p 🔵 GitBags Money-Flow Audit — Pre-Audit Working Tree State (S129)
1751 " 🔵 Bags API v3.0.0 Fee Claim Surface — Confirmed for Audit
1758 " 🟣 4 Parallel Money-Flow Fix Agents Dispatched — Finding 1–4 Coverage
1759 " 🔵 GitBags Money-Flow Code Map — Manual Reconciliation Sentinel Pattern
1755 5:29p 🔵 GitBags Admin Direct Launch — Double-Spend Risk from Post-Chain DB Failure
1756 " 🔴 retryPayout Does Not Resume Payout Pipeline — executePayout Skips Existing Rows
1757 " ⚖️ Worker C File Boundary Discipline — Payout/Reconciliation Helpers Off-Limits
1764 5:31p 🔵 Finding 4 Confirmed — retryPayout Cannot Resume Execution
1765 " 🔵 Finding 2 Confirmed — Launch Double-Spend: Chain Tx Before DB Persistence
1766 " 🔵 Finding 3 Confirmed — Fee-Share Update Loses Partial Signatures on Failure
1767 " 🔵 GitBags Tech Stack Confirmed — Bun 1.3.12, Next.js 16.2.4, workflow@4.2.4, Vitest
1760 5:32p 🔵 executePayout Workflow Only Processes Snapshots With No Payout Row — Failed Rows Are Dead Ends
1761 " 🔵 API Route launch/route.ts Has launch_configured Resume Path — Admin directLaunchProject Does Not
1762 " 🔵 Manual Reconciliation Sentinel Exists in payout-helpers.ts — retryPayout Must Guard Against It
1763 " 🔵 GitBags Payout Retry Fix Direction — Trigger processSnapshotPayout for Existing Snapshot ID
1768 5:33p 🔴 fee-share-update partial-success signature loss — hardening plan dispatched
1769 " ⚖️ Incremental signature persistence + manual-reconciliation sentinel pattern chosen for fee-share retry safety
1770 5:34p ⚖️ GitBags Launch Double-Spend Fix — Worker B Scope Assignment
1771 5:36p 🔵 GitBags Money-Flow Security Audit — Scope Definition and Research Plan
1772 5:37p 🔴 Admin Direct Launch — Durable launch_configured Checkpoint Before Final On-Chain Transaction
1773 " 🔴 retryPayout — Both Admin and Dashboard Actions Now Actually Trigger Payout Workflow Instead of Flipping Status to Pending
1774 " 🔄 claimPartnerFees Migrated to reservePartnerFeeClaimAttempt + executePartnerFeeClaimAttempt Helper Pattern
1775 5:40p 🔴 Payout Claim Ambiguity — Manual Reconciliation Sentinel + Signature Preservation
1776 " 🔴 Launch Double-Spend Prevention — pending: Sentinel + launch_configured Checkpoint
1777 " 🔴 retryPayout — Blocks Ambiguous Cases, Starts Workflow at claiming State
1778 " 🔴 Fee-Share Update Partial-Success Hardening — Per-Tx Signature Persistence + Retry Guard
1779 " ✅ Money-Flow Hardening — Full Quality Gate: 22/22 Tests, Typecheck, Lint All Green
1780 " 🔵 GitBags Money-Flow Residual Risk Registry — Post-Audit Known Gaps
1781 6:24p 🔵 Latest Bun Release — v1.3.13
1782 6:25p 🔵 Bun v1.3.13 Release Notes Contain No HTTP/3 Feature
1784 " 🔵 Bun HTTP/3 API Surface — `protocol: "http3"` for fetch, `h3: true` for Bun.serve
1788 6:27p 🔵 Bun HTTP/3 Merged to Main Post-1.3.13 — Requires Canary 1.3.14 or Next Stable
1789 " ✅ GitBags Bun Version Bumped 1.3.12 → 1.3.13 Across All Pin Locations
1790 " 🟣 New scripts/check-bun-http3.mjs — HTTP/3 Canary Availability Checker
1793 6:28p ✅ GitBags Bun 1.3.12 → 1.3.13 Upgrade — All 6 Pin Locations Updated and Verified Clean
1797 6:29p 🔵 check-bun-http3.mjs Correctly Detects Local Bun 1.3.12 as Below Minimum — Developer Must Run `bun upgrade`
1798 " ✅ gitbags-prd.md + vercel.json Doc Pass — Neon Terminology, Env Var Canonicalization, Missing Cron Added
1799 " ✅ apps/web dev/build/start Scripts Changed to `bun run --bun next` — Opt Into Bun Runtime for Next.js
1806 6:34p 🔵 GitBags Post-Upgrade Quality Gate — All Green (S133 Final Verification)

Access 1654k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
