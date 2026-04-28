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

- **Runtime**: Bun workspace monorepo, Next.js 16.2 (App Router, Server Actions, Turbopack, React Compiler), React 19.2, Node 22.
- **DB**: Neon Postgres via `drizzle-orm/neon-http` for workflow steps; `neon-serverless` for multi-statement transactions. Non-Neon `DATABASE_URL`s (Supabase pooler, local Postgres) fall back to `drizzle-orm/postgres-js` — RLS context wrapping is Neon-only, so non-Neon paths rely on `requirePermission` for authorization.
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

# [gitbags] recent context, 2026-04-28 3:31pm CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (25,594t read) | 2,826,438t work | 99% savings

### Apr 28, 2026
1595 12:58a 🔵 GitBags Complete Route Inventory vs PRD Gap Analysis
1601 1:01a ⚖️ GitBags Public Surface Deslop Pass — Scope and Constraints Defined
1602 1:02a 🟣 PageHeader Component — New Shared Dashboard Page Header Primitive
1603 " 🔄 Dashboard ProjectList — Rows Converted to Full-Width Clickable Links
1604 " 🔄 OnboardingHero — Card Grid Replaced with Layout-Based Step Panel
1605 " 🔄 Account Dashboard Pages — PageHeader Applied, Card Nesting Removed
1606 " 🔄 Project Console Pages — PageHeader Applied Across All 10 Sub-Routes
1607 " ✅ Dashboard Deslop — Typecheck and Lint Pass Clean After All Changes
1608 1:06a 🟣 GitBags Public Surface Deslop Pass — Full Scope Completed
1609 1:08a ✅ Quality Gate Passed — Typecheck, Lint, Theme:Lint All Green
1610 " 🔴 v1.1 / "Coming Soon" Language Fully Purged from User-Facing Copy
1611 " ⚖️ Subagent Changes Partially Reverted — Only Core Deslop Kept
1612 " 🟣 PublicPageIntro Component Adopted for Legal and Public Content Pages
1613 1:09a ✅ E2E Suite Green — 6/6 Playwright Tests Pass Against Production Build
1614 " 🔵 GlobalLeaderboardTable Final State — overflow-x-auto Wrapper Retained
1615 " 🔄 ExploreFilters — Custom Dropdown Replaced with Native Select + ARIA
1635 1:38a ⚖️ AI Agent Fee Routing — Treasury Wallet Failsafe for Agent Contributors
1637 " 🔵 GitBags Payout + Bot Detection Architecture — Full Map for AI Agent Treasury Routing
1640 1:39a 🔵 GitBags Payout Pipeline — Complete Code Path for AI Agent Treasury Routing Implementation
1646 1:40a 🟣 AI Agent Treasury Routing — Full Implementation Across Scoring, Indexer, Snapshot, and Payout Pipeline
1649 1:41a ✅ AI Agent Treasury Routing — Quality Gate Verification: All 42 Tests Pass, Typecheck and Lint Clean
1653 " ✅ AI Agent Treasury Routing — Production Build and E2E Suite Pass, Full Staging State
1655 1:39p 🔵 GitBags Money-Flow Security Audit — Scope and Prior Architecture Map
1656 1:41p 🔵 GitBags Money-Flow Architecture — Full Revenue Rails Map
1657 " 🔵 GitBags Payout Guard Stack — Idempotency, Audit, and Permission Architecture
1658 " 🔵 GitBags AI Agent Treasury Redirect — Policy and Implementation
1659 " 🔵 GitBags Money-Flow Test Coverage Gaps — Flagged Risk Areas
1661 1:58p ⚖️ elizaOS + "Mia" AI Character — Strategic Feature Exploration for GitBags
1666 2:06p 🔵 Twitter/Social References Audit — GitBags Codebase
1667 " ✅ Twitter/X Social Links Updated — @bagsdotfm → @GitBagsApp
1669 2:07p 🔵 GitBags Working Tree — Broader In-Progress Changes Beyond Social Link Update
1672 2:13p 🔵 GitBags Database Caching Audit — Session Initialization and Context Loading
1673 " 🔵 GitBags Pre-Audit Working Tree State — In-Progress Money-Flow Changes
1674 " 🔵 Next.js 16.2.4 Caching API Surface — Full Local Docs Inventory
1675 " 🔵 GitBags Caching Architecture — System Design and Redis Role Confirmed from PRD
1680 2:14p 🔵 GitBags Cache Layer Architecture — Existing unstable_cache Infrastructure Without cacheComponents Enabled
1681 " 🔵 Multi-Agent Caching Audit — Four Parallel Subagents Spawned Successfully
1682 " 🔵 next.config.ts — No cacheComponents, No cacheHandlers, Strict CSP with Pending Nonce Work
1679 " ⚖️ GitBags Database Caching Audit — Two-Phase Multi-Agent Remediation Plan
1683 2:17p 🔵 GitBags Caching Architecture — Full Audit Map
1684 " 🔵 GitBags PRD Caching Constraints — Next.js 16.2 Cache Components API Confirmed Present
1685 " 🔵 GitBags Caching Pain Points — Comprehensive List of Gaps and Antipatterns
1686 " 🔵 GitBags Pre-Audit Working Tree State — 12 Modified Files with In-Progress Money-Flow Changes
1687 2:23p 🔴 PATCH + DELETE Cache Invalidation and Idempotency Gaps Fixed — projects/[id] Route
1696 3:18p ⚖️ Vercel Workflow SDK Adoption — GitBags Platform Architecture Pivot
1698 " 🔵 Vercel Workflow SDK — Step Idempotency Is NOT Automatic in GitBags
1699 3:21p 🔵 GitBags Complete Workflow Inventory — 9 Workflows, Full Architecture Map
1700 " 🟣 workflow-locks.ts — Redis Single-Flight Lock for Cron Fanout Workflows
1709 3:22p 🟣 Redis Single-Flight Locks Wired Into All 5 Root Workflows
1710 3:24p 🔴 Payout + Escrow Partial Chain Success Recovery — Manual Reconciliation Error Pattern

Access 2826k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
