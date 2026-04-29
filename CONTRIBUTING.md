# Contributing

Thanks for your interest in GitShipt. Read [CLAUDE.md](CLAUDE.md) and
[AGENTS.md](AGENTS.md) before non-trivial work — they bind every decision.

## Quick start

```bash
git clone <repo>
cd gitshipt
bun install
cp .env.example .env.local        # populate secrets
bun run db:migrate                 # apply latest schema
bun run dev                        # http://localhost:3000
```

## Pre-ship checklist

Before opening a PR, run:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run theme:lint
bun run test
bun run e2e         # local: install browsers via `bun run e2e:install`
bun run build
```

CI runs the same pipeline on every PR via `.github/workflows/ci.yml` plus
`bun audit`.

## Commit style

- One logical change per commit.
- Imperative mood: "Add", "Fix", "Refactor".
- Reference an issue or audit finding in the body when applicable.

## Code style

- TypeScript strict; `noUncheckedIndexedAccess` is on.
- Prefer Server Components; mark `"use client"` only when required.
- No raw hex colours in components — use semantic tokens.
- Mono fonts (`text-mono-*`) for SOL, USD, BPS, scores, timestamps,
  and tx signatures only. Body copy is never mono.
- `proxy.ts` is redirects only — auth must be revalidated inside every
  protected route handler and Server Component.
- Mutations must: revalidate the session → `requirePermission` →
  Zod-validate input → respect `Idempotency-Key` → write an audit row →
  revalidate cache tags.
- Use `validateClientKey` from `@/lib/idempotency` on any client-supplied
  idempotency key.

## Testing

- Unit and integration tests live under `apps/web/lib/**/*.test.ts` and
  `apps/web/workflows/**/*.test.ts`.
- E2E specs live under `apps/web/e2e/`.
- Run a single file: `cd apps/web && bun run vitest run path/to.test.ts`.
- Run a single Playwright spec: `cd apps/web && bun run playwright test e2e/file.spec.ts`.

## Security

Do not file security findings as public issues. See
[SECURITY.md](SECURITY.md) for the disclosure process.

## Contributor Licence Agreement

By contributing, you agree your contributions are licenced under the MIT
licence as described in [LICENSE](LICENSE).
