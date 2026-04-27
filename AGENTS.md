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
- **One primary per viewport.** Stacking purple buttons + purple sparklines + purple pills in the same fold is the most common drift. Pick one.
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

# [gitbags] recent context, 2026-04-26 8:16pm CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (23,569t read) | 3,001,181t work | 99% savings

### Apr 26, 2026
631 5:33p 🔵 GitBags Security Audit: P0 Bugs — Fee Claim No-Op + Token Marked Live Prematurely
632 " 🔵 GitBags Security Audit: P1 Bugs — Idempotency Races, Double Payout, Auth Secret Fallback, Redis Fail-Open
630 " 🔵 Zustand v5 Best Practices for Next.js 16 App Router Monorepo — April 2026 Research
635 5:35p 🟣 GitBags: Zustand uiStore Created in @repo/ui Package — Sidebar State Migrated
636 " 🟣 GitBags: SidebarUserCard Sign-Out Migrated from Server Action to Optimistic Client-Side Flow
637 " 🟣 GitBags: uiStore Vitest Tests Added — All 6 Tests Passing Clean
638 " 🔵 GitBags State Audit: 380 useState/Context References Across 203 Files — Zustand Migration Scope Mapped
639 5:36p 🔵 GitBags Zustand Store Split: uiStore in @repo/ui, authStore in apps/web
640 " 🔵 AuthStoreUser vs SessionUserChrome: Duplicate Shape, Intentional Boundary
641 " 🔵 GitBags Package Dependency Graph: @repo/lib → @repo/ui → @repo/shared (isolated), apps/web → all
642 " 🔵 uiStore Sidebar State: localStorage + Cookie Dual-Persistence, Server-Read via sidebar-state.ts
644 5:38p 🔵 GitBags Auth Architecture: Full Server-Owned vs Zustand Store Boundary Map
645 " 🔵 GitBags: Zustand Auth Store Used Only in 3 Client Components — Not Navigation or Wallet State
646 " 🔵 GitBags: Public Layout Missing Server-Side User Fetch — Relies Entirely on Root Layout Context
647 " 🔵 GitBags: Server Actions Pattern — Every Mutation Re-Validates Session Independently (CVE-2025-29927)
650 " 🔵 GitBags: Sidebar uiStore Updated to Vanilla+Context Pattern (useUiStoreValue)
651 " ✅ GitBags: sign-out-action.ts Server Action Deleted — Replaced by Client-Side authClient.signOut()
652 " 🔵 GitBags Zustand Audit: WizardShell Has 7 useState Pieces — Strong launchWizardStore Candidate
654 5:40p 🔄 GitBags uiStore: Final Vanilla+Context Implementation Confirmed
655 " 🟣 GitBags: useLaunchWizardStore Created — All 7 WizardShell useState Calls Replaced
656 " 🔴 GitBags: ReviewAndSign isPending Was Hardcoded false — Now Driven by Zustand Status
657 " 🔄 GitBags: AuthStoreUser De-duplicated — Now Type Alias for SessionUserChrome
658 " 🔵 GitBags App Shell Architecture: SidebarProvider Placement Across Four Layout Types
675 5:58p 🔵 GitBags Security Audit: Focused Investigation on 7 High-Priority Vulnerabilities
704 6:31p 🔵 GitBags Bags SDK Audit: Confirmed Wired Features vs. Untouched Capabilities
705 " 🔵 GitBags Bags Integration: Prioritized Gap List with Implementation Paths
706 6:33p ⚖️ GitBags Post-Merge Security Audit Scope Defined
717 6:50p 🔵 GitBags Security Audit: 7 Findings Across P0–P2 Severity
718 " ⚖️ GitBags: Full Zustand Global State Migration Initiated via Multi-Agent Orchestration
719 6:52p 🔴 P0 Fix: signAndSubmitViaBags Now Handles Both Transaction and VersionedTransaction Types
720 " 🟣 env.ts: Default Partner Wallet, BAGS_REF_CODE, and productionReadiness() Added
721 " 🟣 New api-key-auth.ts Middleware: Project-Scoped API Key Verification
722 " 🟣 Leaderboard API Route: Optional API Key Auth Added
723 " 🟣 Health Route and Admin Integrations: Production Readiness Check Added
724 " ✅ Bags Client: Partner Wallet/Config Resolution Simplified + Ref Code Added to Intent URLs
727 6:58p ✅ Stale Feature Branches Deleted After Merge to Main
748 7:17p ⚖️ GitBags Operator/Security Slice: Task Scope + Ownership Boundaries
787 7:41p 🔵 GitBags: Drizzle NeonHttp Query Failure on Project Slug Lookup
790 7:43p 🔴 GitBags DrizzleQueryError Root Cause: Migrations 0003+0004 Never Applied to Neon DB
791 " 🔵 GitBags: Production Build and Full Test Suite Pass After Schema Fix
792 " 🔵 GitBags: 30+ Zombie context7-mcp Processes Survive SIGTERM — Parented to Cursor (PID 1779)
795 7:46p 🔴 GitBags Process Cleanup Complete: Dev Server and 32 context7-mcp Workers Killed
797 7:49p ✅ GitBags Migration Journal Fix Committed and Pushed to main
816 8:06p 🔵 DEP0169 url.parse() Deprecation Warning in LandingPage
818 " ✅ GitBags apps/web/package.json: NODE_OPTIONS --no-experimental-webstorage Added to All Scripts
819 8:08p 🔴 GitBags redis.ts: url.parse() Replaced with WHATWG URL API via redisOptionsFromUrl()
826 8:10p 🔵 GitBags Vercel Build Failure: Unmatched Cron Function Pattern
828 8:11p 🔵 GitBags Vercel Build Failure: Unmatched Cron Function Pattern
832 8:14p 🔴 GitBags vercel.json `functions` Block Removed — maxDuration Migrated to Route Segment Config
833 " 🔵 GitBags Vercel Project Node.js Version Mismatch: package.json 22.x vs Project Settings 24.x

Access 3001k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
