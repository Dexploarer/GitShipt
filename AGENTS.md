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
- **DB**: Neon Postgres via `drizzle-orm/neon-http` for workflow steps; `neon-serverless` for multi-statement transactions.
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

# [gitbags] recent context, 2026-04-28 8:55am CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (19,452t read) | 2,629,272t work | 99% savings

### Apr 28, 2026
1548 12:16a 🟣 defaultDashboardRoute Wired Through Session Chrome to Sidebar
1549 " 🟣 ProfilePage Two-Column Layout with Editable Form
1550 " 🟣 Settings Page Refactored — Preferences Form + Account Areas List
1558 12:17a 🔴 Two CI Failures Fixed — Test Type Mismatch and ESLint set-state-in-effect
1559 " 🟣 Avatar URL Security — Server Action Validates Against GitHub Hostname Allowlist
1560 " 🔄 ProfileEditor and AccountPreferencesForm — router.refresh() After Saves
1566 12:18a 🟣 GitBags Account Management Full Stack — CI Green, Production Build Clean
1570 12:23a 🔵 Missing DB Migration — user_settings Table Does Not Exist
1572 " 🔴 Migration 0008_user_settings Applied — App 500 Crash Resolved
1574 " 🔵 db/rls-context.ts Imports server-only — Cannot Run Outside Next.js
1577 12:24a 🔵 user_settings Table Confirmed Exists in Neon DB
1579 12:44a ✅ GitBags Account Pages + Sidebar Refactor — Committed and Merged
1580 12:45a 🔵 GitBags Full Commit Scope — 130+ Files Staged on main Branch
1582 " ✅ Commit b272da9 — "Polish authenticated UI and account settings" — 159 Files, 5842 Insertions
1584 12:46a ✅ Commit b272da9 Pushed to origin/main — GitBags Account UI Complete
1586 " 🔵 AGENTS.md Modified After Push — One Unstaged File Remains
1587 12:52a ⚖️ Post-Commit — UI Quality Audit Pass Initiated Using 7 Design Skills
1588 " 🔵 spawn_agent Rejects agent_type on Full-History Fork — API Constraint
1590 " 🟣 4 Parallel Audit Subagents Spawned for GitBags Completion Pass
1591 12:53a 🔵 GitBags UI/UX Audit — Scope and Constraints Defined
1592 12:55a 🔵 Agent Thread Limit Reached at 6 — Admin and /r Subagents Blocked
1593 " 🔵 Broken Link — RecentPayoutsFeed Links to Non-Existent /dashboard/payouts Route
1594 " 🔵 Admin v1.1 Stubs — Treasury Top-Up, Snapshot Verification, Banner Display, Payouts Snapshot Trigger Not Wired
1595 12:58a 🔵 GitBags Complete Route Inventory vs PRD Gap Analysis
1596 " 🔵 GitBags Known Stubs, "Coming Soon" Features, and v0 Deferreds
1597 " 🔵 Broken Placeholder Href in Project Docs Page
1598 " 🔵 Dead Internal Link — /dashboard/payouts Route Does Not Exist
1599 " 🔵 GitBags API Security Posture — All Mutation Routes Gate Auth Correctly
1600 " 🔵 GitBags Admin Workflows Page — Full Workflow Inventory with Manual Trigger Support
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

Access 2629k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
