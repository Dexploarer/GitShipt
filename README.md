# GitBags

Pump.fm for open source. Launch a Bags.fm token for any GitHub repo; daily trading fees redistribute to the top contributors.

Built for the Bags.fm Hackathon (submission April 28, 2026).

## Stack

Next.js 16.2 · React 19.2 · TypeScript strict · Tailwind v4 · shadcn/ui · Drizzle ORM · Neon Postgres · Upstash Redis · Vercel Workflows · `better-auth` + SIWS · `@bagsfm/bags-sdk` · Solana web3.js v1 · Helius RPC.

## Source of truth

Two files at the repo root bind every decision:

- [`DESIGN.md`](./DESIGN.md) — visual system, dual-palette token table.
- [`gitbags-prd.md`](./gitbags-prd.md) — product spec, architecture, data model, security baseline.

If documentation here disagrees with those, the spec wins. See [`AGENTS.md`](./AGENTS.md) for the agent-context summary.

## Local dev

```bash
pnpm install
cp .env.example .env.local       # fill in credentials
pnpm db:generate && pnpm db:migrate
pnpm dev
```

Visit <http://localhost:3000>.

## Scripts

- `pnpm dev` — Next dev server (also runs Workflow Local World).
- `pnpm build` / `pnpm start` — production build + serve.
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm lint` — ESLint.
- `pnpm test` — Vitest unit tests.
- `pnpm e2e` — Playwright e2e + dual-theme screenshot tests.
- `pnpm db:generate` — drizzle-kit generate.
- `pnpm db:migrate` — drizzle-kit migrate.
- `pnpm db:studio` — drizzle-kit studio (DB browser).
- `pnpm theme:export` — regenerate `tailwind.theme.json` from `DESIGN.md`.
- `pnpm theme:lint` — DESIGN.md WCAG AA contrast check.
