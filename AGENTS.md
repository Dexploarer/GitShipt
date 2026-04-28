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

# [gitbags] recent context, 2026-04-27 1:20am CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,328t read) | 3,333,547t work | 99% savings

### Apr 26, 2026
954 10:59p 🔴 Audit Updated: M9 Hydration Mismatch on /explore + L5 Next Image Aspect-Ratio Warning
1005 11:36p 🔵 GitBags Full System Audit — 2 Critical, 7 High, 9 Medium, 5 Low Issues Found
1006 11:37p 🔵 GitBags AUDIT-2026-04-27.md — Full Audit Findings Map for Admin Worker D
1007 " 🔵 GitBags vercel.json Cron Schedule Ground Truth — M4 Discrepancy Confirmed
1008 " 🔵 GitBags Admin Directory Structure — 31 Files Across 15 Admin Route Segments
1009 " 🔵 GitBags AUDIT-2026-04-27 Full Issue Inventory — Worker E Regression Coverage Session
1010 " 🔵 GitBags Test Infrastructure Baseline — Existing Coverage Map Before Worker E Additions
1011 11:39p 🔵 GitBags Admin Workflow Architecture: retriggerWorkflow Action + 8 Workflow Files
1012 " 🔵 GitBags Admin Project Detail Page: God-Mode Controls and Status Badge Architecture
1013 " 🔵 GitBags UI Design System: Badge and Button Primitive Variants Confirmed
1014 11:45p 🟣 GitBags Admin Workflows Page: vercel.json-Aligned Schedule Display + ManualTrigger Discriminated Union
1015 " 🟣 GitBags WorkflowRetriggerButton: Queued/Failed Result State + disabledReason Prop
1016 " ✅ GitBags Admin Pages: Honest Completeness Badges on DB, Feature Flags, Abuse, and Ops Dashboard
1017 11:46p ⚖️ GitBags Audit C2 — Snapshot/Payout Idempotency Remediation Scope Defined
1018 11:48p 🟣 GitBags Playwright Regression Suite Added — 5 New E2E Tests for Audit Findings H6/L2/M9
1019 " 🟣 GitBags SIWS Unit Test Suite Added — Nonce Issuance and Single-Use Verification
1020 " 🟣 GitBags destructiveAction Test Coverage Extended — Confirmation Mismatch and Stale MFA Cases
1021 " 🟣 GitBags Launch Wizard Stub-Mode Test Added to launch-wizard-store.test.ts
1022 " 🔴 snapshot-payout-idempotency.test.ts: server-only Import Crash Fixed via Dynamic Imports
1023 " 🔵 GitBags E2E: Light Theme Axe Contrast Test Fails — Real Color-Contrast Violations in /explore Light Mode
1024 " 🔵 GitBags E2E: public-routes.spec.ts Flaky Under Parallel Workers Due to next.config.ts Hot Reload
1025 " 🔵 GitBags Worker E Final Quality Gates — All Unit Tests Green, Build Clean, Axe Contrast Blocker Outstanding
1030 11:55p 🔴 SPL Escrow Drain: Token Holdings No Longer Falsely Marked "Drained"
1031 " 🔴 Snapshot Period Idempotency: Duplicate Payout Risk Eliminated via UNIQUE Index + Upsert
1032 " 🔴 Payout Dispatch Race Condition Fixed: Compare-and-Swap on Recipient Status
1033 " 🔴 Dependency Audit: Package Overrides + Vulnerable Packages Removed to Reduce vuln Count
1034 " 🟣 CSP Report-Only Header Added for Production Violation Detection
1035 " 🔴 Mobile Footer Occlusion Fixed with Safe Area Inset Padding
1036 " 🟣 Homepage Hero Replaced: Mascot Image Removed, ProductRailVisual Terminal Added
1037 " 🔴 Light Theme Contrast Tokens Darkened for WCAG AA Compliance
1038 " 🔴 Explore Page h1 Added — Semantic Heading Fixed
1039 " 🟣 Admin Console: Surface Status Card + Coming-Soon Badges on Placeholder Pages
1040 " 🔴 Admin Workflow Page: Schedule Sourced from vercel.json Instead of Hardcoded Strings
1041 " 🟣 Test Coverage: destructiveAction MFA + Launch Wizard Store Stub-Mode Cases Added
### Apr 27, 2026
1053 12:07a 🔵 GitBags Audit Pass — Full Quality Gate Results Confirmed
1054 " 🔄 BentoTickerCell: Client Component Eliminated, Simulated Drift Removed
1055 " 🔵 GitBags Landing Page Data Architecture: Redis-First with DB Fallback
1056 " ✅ GitBags Audit Remediation: 60-File Commit Pending with Full Audit Coverage
1058 12:08a 🟣 ProductRailVisual: Static Terminal Card → Live Data Settlement Board
1059 12:21a 🟣 ProductRailVisual Skeuomorphic Polish Pass Designed (Patch Pending)
1060 12:22a 🟣 ProductRailVisual Skeuomorphic Polish: Build Passes + Screenshot Captured
1067 12:29a 🔄 GitBags ProductRailVisual: Skeuomorphic PCB Aesthetic Replaced with Open Spacious Layout
1069 12:34a ✅ GitBags Landing: Tokenized Repo Panel Removed from ProductRailVisual
1071 12:36a 🔵 GitBags Production Build Green — 84 Dynamic Routes, Dev Server on Port 3000
1074 " 🔵 GitBags Landing Two-Column Layout: Screenshot Confirmed, Height Re-Tuned
1079 12:41a 🟣 GitBags Landing: ProductRailVisual Replaced with /mia.png Mascot Hero Image
1101 12:52a 🔴 GitBags Landing Hero: Space Restored Between Two-Column Grid and KPI Strip
1108 1:15a ✅ GitBags Sidebar Header: Logo Added Left of Brand Name
1109 1:16a 🔵 GitBags AppSidebar Header Structure — CollapsibleBrand Component, No Logo
1111 " ✅ GitBags Sidebar Header: logo.png Added Left of Brand Name

Access 3334k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
