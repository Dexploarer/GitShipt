# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Read `DESIGN.md` and `gitshipt-prd.md` before non-trivial work. Where they conflict with training data or this file, they win.

## Commands

All commands run from the repo root. Bun reads `.env.local` via `--env-file` for app + DB scripts.

```bash
bun install                    # install workspace deps
bun run dev                    # Next 16 dev server (apps/web on :3000, Turbopack)
bun run build                  # production build (output: apps/web/.next)
bun run start                  # serve production build
bun run lint                   # ESLint (apps/web)
bun run typecheck              # @repo/lib + @repo/shared + @repo/ui + apps/web (in order)
bun run test                   # Vitest run (apps/web)
bun run test:watch             # Vitest watch
bun run e2e                    # Playwright (chromium); run e2e:install once first
bun run e2e:install            # installs chromium with deps
bun run theme:lint             # detect raw hex drift in apps/web + packages
bun run theme:export           # regenerate .theme/tokens.json
bun run format                 # prettier across ts/tsx/js/json/md/css
```

Database (Drizzle, run from repo root, executes inside `apps/web` with `.env.local`):

```bash
bun run db:generate            # generate migrations from schema
bun run db:migrate             # apply migrations
bun run db:push                # push schema (dev only)
bun run db:studio              # Drizzle Studio
```

Run a single Vitest file or pattern (cd into the app — root script wraps `vitest run`):

```bash
cd apps/web && bun run vitest run path/to/file.test.ts
cd apps/web && bun run vitest run -t "test name pattern"
```

Run a single Playwright spec:

```bash
cd apps/web && bun run playwright test e2e/regression.spec.ts
cd apps/web && bun run playwright test -g "title pattern"
```

Pre-ship verification (matches README): `bun install --frozen-lockfile && bun run typecheck && bun run lint && bun run theme:lint && bun run test && bun run e2e && bun run build`.

## Architecture overview

The product flow defines the architecture: **GitHub activity → ranked contributors → daily snapshot → Bags fee claim → SOL payout by rank**. Each arrow is a Vercel Workflow in `apps/web/workflows/`, glued together by Postgres state and Redis idempotency keys.

**Workflow chain** (all under `apps/web/workflows/`):

- `indexGithubDeltas` / `indexProjectDeltas` — pull commits/PRs/reviews via Octokit App, write to DB.
- `computeLeaderboard` — turn activity into ranked contributors using `lib/scoring/`.
- `takeSnapshot` — freeze daily leaderboard into an immutable period (UNIQUE-indexed; idempotent upsert).
- `executePayout` — claim Bags fees via `sdk.fee.*`, dispatch SOL to ranked recipients with compare-and-swap status writes.
- `expireEscrow`, `processClaim`, `publishKpis`, `healthPulse` — adjacent housekeeping.
- `steps/` — shared step helpers. **Step idempotency is not automatic**; pass `getStepMetadata().stepId` as the key for any external API call.

Cron triggers in `vercel.json` hit `/api/cron/*` handlers (protected by `CRON_SECRET`), which start the corresponding workflow.

**Data layer** (`apps/web/db/`):

- `schema/` — one Drizzle file per concern.
- `index.ts` exports `dbHttp` (Neon HTTP, default for reads/single-statement writes) and `dbPool` (Neon serverless pool, for multi-statement transactions).
- Non-Neon `DATABASE_URL`s (Supabase pooler, local Postgres) fall back to `drizzle-orm/postgres-js`. RLS context wrapping (`db/rls-context.ts`) is **Neon-only** — non-Neon paths must rely on `requirePermission` for authorization, not RLS.

**Auth + permissions** (`apps/web/lib/auth/`):

- `better-auth` with GitHub OAuth + custom SIWS plugin (Phantom sign-in-with-Solana) for wallet linking.
- TOTP MFA via `otpauth`, used to gate destructive admin actions.
- `proxy.ts` (Next 16's renamed middleware) is **redirects only** — every protected Server Component, Server Action, and route handler must revalidate session in-process (CVE-2025-29927 mitigation).
- Mutations must: revalidate session → `requirePermission` → Zod-validate input → respect `Idempotency-Key` (`lib/idempotency.ts`) → write audit log on success (`lib/audit.ts`) → revalidate cache tags.

**External clients** (all stub-flippable based on env presence; never invent secrets):

- `lib/bags/client.ts` — `@bagsfm/bags-sdk` Token Launch v2. Two rails kept separate: contributor fee claimers (must total 10,000 bps) and optional `BAGS_PARTNER_*` config. Claims use `sdk.fee.*` (not `sdk.feeClaim.*`).
- `lib/solana/` — `@solana/web3.js@^1.98.x` (v1, **not** `@solana/kit`). Helius RPC. `SOLANA_PAYOUT_KEYPAIR` signs fee-share config txs; cold treasury keys never touch Vercel.
- `lib/github/` — Octokit App for installation reads + webhook HMAC verification at `/api/webhooks/github`.

**UI** (`apps/web/components/` + `packages/ui/`):

- Tailwind v4 with `@theme inline` in `apps/web/app/globals.css` — there is no `tailwind.config.js`.
- Two palettes (dark canonical + light mirror) resolve via CSS variables; components never call `useTheme()` except `theme-toggle.tsx`.
- Use semantic tokens (`bg-surface`, `text-fg`, `text-fg-secondary`, `border-border-strong`, `text-rank-gold`); no raw hex in components.
- Numeric values (SOL, USD, BPS, scores, timestamps, tx signatures) use `text-mono-md` / `text-mono-sm`. Body copy is never mono.

**Workspace barrels** — import shared code via these, keep app-owned code on `@/*`:

- `@repo/ui` — shadcn-style primitives (`packages/ui`)
- `@repo/lib` — pure utilities, e.g. `cn`, `formatSol` (`packages/lib`)
- `@repo/shared` — Zod schemas + types reused on client + server (`packages/shared`)

**Route realms** (`apps/web/app/`): `(public)` (landing/explore/leaderboard/launch/docs), `(auth)`, `dashboard/` (project owner), `admin/` (super-admin, separate session realm), `r/[org]/[repo]` (public project pages), `api/` (route handlers).

## Stub-safe mode

External clients ship with deterministic stub fallbacks. Without Bags / Helius / payout-keypair credentials, launch records the metadata mint and fee-share config key but does not broadcast the final launch tx. When you hit a credential blocker, name the exact missing env var in one sentence and stop — do not invent secrets.
