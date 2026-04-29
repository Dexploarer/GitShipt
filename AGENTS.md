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

# [gitbags] recent context, 2026-04-28 10:31pm CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (24,051t read) | 1,450,059t work | 98% savings

### Apr 28, 2026
1973 9:06p 🔵 Landing Page Discloses Simulated 24h Volume — Finding 5 Scope Mapped
1974 " ⚖️ Simulated Volume Metric — Credential-Gated Display vs. Outright Removal
1972 " 🟣 PublicNav Mobile Collapse Implemented via Sheet Component
1976 9:08p 🔵 PublicNav.tsx Patch Review — Finding 3 Scope and Criteria Defined
1977 " 🔵 E2E Stale-Lock Patch (Finding 4) — Code Review Scope and Audit Criteria
1978 9:11p 🔵 Worker 5 Patch Review — Finding 5: Simulated Landing Volume Removal Audit
1979 " 🔵 prepare-e2e-build.mjs Full Implementation — Stale Lock Removal with Active-Build Guard
1980 " 🔵 Playwright webServer CWD — Command Launches from apps/web/, Making process.cwd() Correct
1981 " 🔵 looksLikeNextBuild Regex — Broad "bun run build" Pattern Is a Potential False-Positive Risk
1982 " 🔵 playwright.config.ts webServer Patch — &&-Chain Correctly Propagates Script Failures
1983 9:13p 🔴 CSP Nonce Enforcement Activated — script-src 'unsafe-inline' Removed from Production
1984 " 🟣 PublicNav Mobile Collapse — Sheet-Based Hamburger Menu Added
1985 " 🔴 Playwright E2E Stale Build Lock — prepare-e2e-build.mjs Preflight Script Added
1986 9:14p 🔴 Landing KPI Strip — 3-Cell Orphan Layout Fixed, Volume Guard Added
1987 9:16p 🔴 Simulated 24h Volume Removed From Landing — volumeSource Guard Prevents Future Leakage
1988 " 🟣 Admin Cosign Gate Implemented — Irreversible Actions Require Second super_admin Approval
1989 " 🔵 prepare-e2e-build.mjs Fails Open When lsof Inspection Fails on macOS
1990 " 🔴 Landing 3-Cell KPI Grid Orphan Fixed — sm:grid-cols-3 for No-Volume State
1991 " 🔵 Admin Cosign UX Gap — DestructiveConfirmModal Does Not Surface pendingActionId for Second Approver
1993 9:19p 🔵 GitShipt Admin Cosign Gate Architecture — Pending Action Server-Side Infrastructure
1994 " ⚖️ Admin Cosign UX — Pending State Must Stay Open, Not Close on First Submit
1995 9:20p 🔵 GitShipt Two-Super-Admin Cosign Flow — Architecture Review Scope
1996 9:21p 🔵 prepare-e2e-build.mjs Stale Lock Cleanup — Fails Closed Correctly, No False-Positive Risk
1997 9:23p 🔵 prepare-e2e-build.mjs Live Smoke Tests — All Failure-Closed and False-Positive Cases Verified
1998 9:24p 🔵 GitShipt Full Repo Completeness Audit Requested — Deep Pass Initiated
1999 9:25p 🔵 Global Query Tests Pass Clean After Landing KPI Review
2000 9:27p 🔴 destructive-action.test.ts — Cosign Crash-Resume Test Corrected
2001 " 🔵 GitShipt Production Build — 87 Routes Confirmed Clean After Cosign Fixes
2002 9:29p ⚖️ E2E Stale Lock Helper classifyBuildCommand — Reviewer Approved, False-Positive Resolved
2003 " 🔵 classifyBuildCommand Resolves False-Positive in E2E Stale Lock Helper
2004 " 🔵 Cosign Resumed-Row Execution Not Atomically Claimed — New Medium Finding
2005 9:31p 🔵 prepare-e2e-build.mjs Full Implementation Confirmed — Line-Level Code Review Complete
2006 9:32p 🔴 Cosign Duplicate-Execution Window Fixed — Stored Idempotency Key Now Forwarded to Action fn
2009 " ⚖️ Cosign Duplicate-Execution Fix — Reviewer Beauvoir Full Approval
2010 9:35p 🔵 Landing Page Simulated Volume Removed — Reviewer Approved With Runtime Verification
2011 " 🔵 prepare-e2e-build.mjs Residual Open Finding — Unrelated Process cwd-Inspection Failure Still Blocks E2E
2012 " 🔵 GitShipt Full Working Tree — 54 Modified Files, 6 Untracked, Uncommitted Before Push
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

Access 1450k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
