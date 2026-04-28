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

# [gitbags] recent context, 2026-04-28 12:44am CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,451t read) | 736,735t work | 97% savings

### Apr 27, 2026
1436 11:26p 🔴 AppSidebar Active Item — Longest-Match Algorithm Replaces First-Match
1437 " 🔄 Dashboard Pages — Page-Level h1 Headers Stripped from (account) Routes
1438 11:28p 🔄 GitBags Dashboard — Full Header Strip and Breadcrumb Normalization Across All 15 Pages
1442 11:29p 🔄 AppSidebar — Collapsed State Polish: Brand Link Hidden, SidebarFooterControls, ReturnToLink Restyled
1443 " ✅ Dashboard Header Sweep — Quality Gate Final Confirmation: All Clean
1447 11:34p ⚖️ GitBags — Authenticated Routes: Caching + Zustand + Zod Requirement
1448 11:35p 🔵 GitBags Caching/Zustand/Zod Audit — Pre-Implementation State
1449 11:36p 🔵 Next.js 16 'use cache: private' — Authenticated Route Caching Strategy
1451 " 🔵 GitBags Dashboard Query Architecture — Full Call-Site Map for Caching Work
1456 11:38p 🔵 GitBags Wallet API Routes — Cache Invalidation Gap Found
1458 " ✅ GitBags Cache System — Authenticated Route Tags and Invalidation Functions Added
1459 11:40p 🟣 GitBags Dashboard Queries — All 11 Functions Cached with getCachedValue + Zod Validation
1460 " 🟣 GitBags Admin Queries — All Functions Cached with getCachedValue + Zod Input Validation
1463 11:41p 🟣 GitBags Cache Invalidation Wired to All Mutation Paths for Authenticated Routes
1467 " 🟣 GitBags New Zustand Store — Authenticated Route Chrome State (useAuthenticatedRouteStore)
1471 11:42p ✅ GitBags Authenticated Route Caching + Zustand + Zod — Production Build Passes Clean
1473 11:43p 🔴 GitBags Two More Cache Invalidation Gaps Fixed — Project Create and Admin Promote-from-Stub
1477 11:49p 🟣 GitBags — Caching, Zustand, and Zod Added to All Authenticated Routes (Session Complete)
1478 11:50p 🔵 Security Page — Direct dbHttp Query Bypasses Cache Layer
1479 " 🔵 GitBags Working Tree — 130 Files, 3221 Insertions Across All Sessions
1485 11:51p 🔵 GitBags Public Route Architecture — Cache Coverage Map
1495 11:53p 🟣 GitBags Cache Layer Extended — Account, Security, Launch, and Slug-Resolution Queries Added
1500 11:54p 🔄 GitBags Bags API and GitHub User Calls Wrapped with getCachedValue
1507 11:55p 🟣 GitBags Dashboard Profile Page — New Route at /dashboard/profile
### Apr 28, 2026
1512 12:02a 🔴 ProfilePage — formatRelativeTime TypeError: date.getTime is not a function
1514 12:03a 🔵 ProfilePage — Exact Call Sites for formatRelativeTime with Deserialized Date Strings
1517 " 🔵 formatRelativeTime Called in 35+ Locations — All Vulnerable to Cache-Deserialized Strings
1518 " 🔴 formatRelativeTime and AccountProfile — Hardened Against Cache-Deserialized Date Strings
1519 12:06a ✅ ProfilePage Date Bug — Full CI Verification Passed After Fix
1522 " 🔵 cache.ts — getCachedValue Has Date/BigInt Serialization, But Only Works for Actual Date Instances
1527 12:07a 🟣 getAccountProfileUncached — Self-Healing GitHub Profile Backfill via GET /user
1529 " 🟣 Session Chrome and Profile/Settings Pages — githubConnected Field Wired Through Three Files
1533 12:08a 🔵 GitBags Working Tree — Profile/Settings/Account Query Files Are New (Untracked) in Launch Push
1534 " 🔴 Cache Version Bump and GitHub Account Filter Bug in /api/github/me/repos
1536 12:09a 🔵 Accounts Table Query Audit — All 5 Call Sites Now Filter by providerId
1540 12:11a 🔵 GitBags Dashboard (account) Route Group — Full Architecture Confirmed
1546 12:14a 🟣 ProfileEditor Client Component — Editable Name, Avatar, and GitHub Sync
1547 " 🟣 AccountPreferencesForm — Email Toggles, Compact Mode, and Default Route Selector
1548 12:16a 🟣 defaultDashboardRoute Wired Through Session Chrome to Sidebar
1549 " 🟣 ProfilePage Two-Column Layout with Editable Form
1550 " 🟣 Settings Page Refactored — Preferences Form + Account Areas List
1551 " 🔄 syncGitHubIdentityForUser — overwriteImage Option Added
1558 12:17a 🔴 Two CI Failures Fixed — Test Type Mismatch and ESLint set-state-in-effect
1559 " 🟣 Avatar URL Security — Server Action Validates Against GitHub Hostname Allowlist
1560 " 🔄 ProfileEditor and AccountPreferencesForm — router.refresh() After Saves
1566 12:18a 🟣 GitBags Account Management Full Stack — CI Green, Production Build Clean
1570 12:23a 🔵 Missing DB Migration — user_settings Table Does Not Exist
1572 " 🔴 Migration 0008_user_settings Applied — App 500 Crash Resolved
1574 " 🔵 db/rls-context.ts Imports server-only — Cannot Run Outside Next.js
1577 12:24a 🔵 user_settings Table Confirmed Exists in Neon DB

Access 737k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
