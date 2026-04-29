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

# [gitbags] recent context, 2026-04-29 12:40am CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,515t read) | 3,226,748t work | 99% savings

### Apr 28, 2026
2013 9:38p 🔵 Cosign Duplicate-Execution Fix — Final Re-Review Confirmed Correct
2036 9:59p ✅ GitShipt Bone Palette Migration — All Changes Committed and Pushed
2037 " ✅ GitShipt "Harden production readiness" Commit — 60 Files, New DB Migration
2039 10:00p ✅ GitShipt Push to origin/main Succeeded — Working Tree Clean
2077 10:09p 🔵 GitShipt Full System Review — Session Initialization and Repo State
2078 10:12p 🔵 GitShipt Full Route Map — 115+ Routes Confirmed Across Public, Dashboard, Admin, API, and Embed Surfaces
2079 " 🔵 GitShipt Security Architecture — CSP, Proxy, Auth, RLS, Rate-Limiting, and Audit Layers All Confirmed
2080 " 🔵 GitShipt Tech Stack — Confirmed Full Dependency Manifest
2081 " 🔵 GitShipt Design System — Bone-Ink Palette with Full Dark/Light Token Set Confirmed
2082 10:15p 🔵 GitShipt Hackathon Submission Description — Consolidated from Source Files
2083 10:16p ✅ GitShipt Public GitHub Repository Created for Hackathon Submission
2084 " ✅ GitShipt Origin Remote Migrated from gitbags to SYMBaiEX/GitShipt and Pushed
2086 " 🔵 GitShipt Codebase Contains No Legacy gitbags References; AGENTS.md Has One Uncommitted Local Change
2299 11:47p 🔵 GitShipt Full System Review Initiated — April 2026 Production Readiness Audit
2300 11:49p 🔵 GitShipt Full System Review — April 2026 Audit Initiated Against 2025/2026 Standards
2301 11:50p ✅ AGENTS.md Committed and Pushed to origin/main
2302 11:51p 🔵 GitShipt Repository Structure Fully Mapped — Routes, Schema, Auth, CI, Security Architecture
2303 " 🔵 Security Architecture Confirmed — proxy.ts CSP Nonce, CVE Defense, env.ts Zod Validation
2304 " 🔵 CI/CD Pipeline Confirmed — 4 GitHub Workflows Including SLSA v1.2 Provenance and Lighthouse CI
2305 " 🔵 Stub Mode Architecture — Full Payout/Launch System Operates Without Production Credentials
2306 " 🔵 cacheComponents Mode Fully Adopted — 5 Named cacheLife Profiles, 'use cache' Migration Complete
2307 " 🔵 Playwright E2E Suite Includes WCAG Contrast Test, Auth Gate Test, and Hydration Regression Tests
2308 " 🔵 Production Env Tooling — check-production-env.mjs, .env.production.example, env:check and env:template Scripts
2309 " 🔵 Vercel Deployment Config — Fluid Compute, 8 Crons, Single Region iad1, Bun 1.x Runtime
2316 11:55p 🔵 GitShipt April 2026 Full System Audit — Scope and Standards Established
2322 11:58p 🔵 DestructiveConfirmModal — MFA-Gated Destructive Action Gate with Full A11y Implementation
2323 " 🔵 Dependency Audit — 2 Vulnerabilities Found (1 High, 1 Moderate) via Transitive Solana/Bags SDK Deps
2334 11:59p 🔵 Production Env Check — 2 Missing Vars and 3 Warnings Block Production Launch
2335 " 🔵 Test Suite — 163 Tests Across 38 Files All Pass in 943ms (Vitest)
2336 " 🔵 CI Pipeline — quality + audit + e2e Jobs on GitHub Actions with Playwright E2E Suite
2337 " 🔵 TokenSparkCard — Confirmed Stub Price/Volume Data for Token Display (Day 3 Feature Gap)
2338 " 🔵 next.config.ts — Full Security Header Suite + nonce-CSP + cacheComponents with Named Profiles
2339 " 🔵 proxy.ts — Per-Request Nonce CSP, CVE-2025-29927 Mitigation, Dashboard Auth Redirect
2340 " 🔵 Cron Auth — All 8 Cron Routes Protected with Timing-Safe CRON_SECRET Comparison
2341 " 🔵 Observability — Vendor-Neutral Structured JSON Logger with Pluggable Adapter Pattern
2342 " 🔵 API Error Response Pattern — Uniform Error Code Shape Across All Routes, No Stack Trace Leakage
### Apr 29, 2026
2347 12:03a 🔵 Stub Mode Architecture — Deterministic Fallback System for All External Services
2348 " 🔵 Production Build — 80 Routes, All PPR (Partial Prerender), Build Passes Clean
2349 " 🔵 E2E Tests — 4/6 Pass, 2 Fail Due to Missing Demo Seed Data (Not Code Bugs)
2350 " 🔵 Critical CSP Bug — Strict-Dynamic Blocks Async Script Tags Missing Nonces in Production Server
2351 " 🔵 Health Check — Live Service Status Confirmed: DB/Redis/Bags/GitHub/Solana All OK, Production Fails on 3 Missing Vars
2352 " 🔵 SLSA v1.2 Supply Chain — Release Workflow with Build Provenance + Dependabot Configured
2353 " 🔵 Root Layout — Suspense{fallback:null} Pattern Applied Across 57 Pages for cacheComponents Compat
2354 " 🔵 POST /api/projects — Full Mutation Pattern: Auth → Rate Limit → Zod → Repo Admin Verify → DB Transaction → Audit → Idempotency
2368 12:23a 🔵 GitShipt April 2026 Production Readiness Audit — 67/100 Score With Critical Runtime Blockers
2369 " 🔵 Critical Blocker — Nonce CSP + PPR/cacheComponents Architecture Is Incompatible at Runtime
2370 " 🔵 Critical Blocker — Project Route Renders Blank (Only "Skip to content") at Runtime
2371 " 🔵 High Blocker — /api/health Always Returns 200 Even When Production Readiness Fails
2372 " 🔵 High Blocker — Env Parity Gap: IDEMPOTENCY_KEY_SECRET Missing From Production Preflight Script
2373 " ⚖️ GitShipt Phase 1–3 Implementation Plan Defined — Four P0 Fixes Gate Beta Readiness

Access 3227k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
