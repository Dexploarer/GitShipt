# GitShipt Completeness and Integration Audit

Date: 2026-04-28
Scope: repository completeness, product UX completeness, Bags Token Launch v2 integration, Solana transaction safety, and current verification state.
Skills applied: `$audit`, `$frontend-design`, `$bags`, `$solana-dev`.

## Anti-Patterns Verdict

GitShipt does not read like a generic AI scaffold. The app has a specific launchpad thesis, a consistent cypherpunk-dark visual language, real route/workflow/schema wiring, and meaningful Bags, GitHub, Solana, auth, audit-log, and payout surfaces.

Verdict: pass with launch-readiness caveats.

The remaining gaps are not "empty app" gaps. They are production completeness gaps: live environment readiness, transaction preview/simulation before signing or server broadcast, contributor claim journey completion, and a few accessibility/test harness regressions introduced or exposed by the current worktree.

## Executive Summary

- Overall completeness: strong foundation, not yet fully production complete.
- Bags integration: mostly aligned with current Token Launch v2, fee share, claim, and partner fee docs, but live launch readiness is currently blocked by environment state and one claim transaction fallback mismatch.
- Solana integration: correct package family for this repo (`@solana/web3.js` v1 because Bags SDK uses v1), but signing paths need explicit simulation/preview hardening before the app should be considered complete.
- UI/product: the design system is coherent and tokenized, but two public flows are incomplete for semantics or product conversion.
- Verification: typecheck, lint, theme lint, tests, and production build passed. `bun audit` and Playwright e2e did not fully pass.

## Verification Run

Passed:

- `bun run typecheck`
- `bun run lint`
- `bun run theme:lint`
- `bun run test`
- `bun run build`
- Playwright smoke against the already-running dev server on `/`, `/explore`, `/leaderboard`, `/launch`, `/docs`, and `/r/SYMBaiEX/gitshipt`: all returned HTTP 200 with no console errors.
- Mobile smoke at 390 x 844 on the same route set: no horizontal page overflow found.

Failed or blocked:

- `bun audit`: 2 residual advisories.
  - `bigint-buffer <=1.1.5`, high, via `@bagsfm/bags-sdk`.
  - `uuid <14.0.0`, moderate, via `@solana/web3.js`.
- `bun run e2e`: Playwright could not start its configured dev server because another Next dev server was already running for `apps/web`.
  - Existing server: PID 85384, cwd `/Users/symbiex/dev/gitbags/gitbags/apps/web`, command `next-server (v16.2.4)`.
- Production readiness evaluator, run with `NODE_ENV=production`, returned `ok: false`.
  - Missing: `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta`, `BAGS_PARTNER_CONFIG_KEY`.
  - Warning: `NEXT_PUBLIC_APP_URL points at localhost.`

## External Docs Checked

- Bags Launch Token guide: https://docs.bags.fm/how-to-guides/launch-token
- Bags fee share configuration API: https://docs.bags.fm/api-reference/create-fee-share-configuration
- Bags claim fees guide: https://docs.bags.fm/how-to-guides/claim-fees
- Bags partner fee claim guide: https://docs.bags.fm/how-to-guides/claim-partner-fees
- Bags program IDs: https://docs.bags.fm/principles/program-ids
- Solana web3.js docs, via Context7 source mirror: https://context7.com/solana-foundation/solana-web3.js/llms.txt
- Local Next.js 16.2.4 docs: `node_modules/.bun/next@16.2.4+a0e5491535050b6b/node_modules/next/dist/docs`

## Findings

### High

#### H1. Production readiness currently fails for live Bags launch mode

Evidence:

- `apps/web/lib/env.ts:176` defines `productionReadiness()`.
- `apps/web/lib/env.ts:224` requires `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta`.
- `apps/web/lib/env.ts:236` requires `BAGS_PARTNER_CONFIG_KEY` when `BAGS_PARTNER_WALLET` is configured.
- Current production-mode evaluation reported missing `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta` and `BAGS_PARTNER_CONFIG_KEY`, plus `NEXT_PUBLIC_APP_URL` still pointing at localhost.

Impact:

The repo is not ready for live Bags launch or production submission in the current environment. The code correctly detects the failure, but the actual deployment inputs are incomplete.

Recommendation:

Set production environment values before claiming production completeness:

- `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta`
- `NEXT_PUBLIC_APP_URL` to the deployed canonical URL
- `BAGS_PARTNER_CONFIG_KEY` matching `BAGS_PARTNER_WALLET`

Suggested follow-up skills: `$bags`, `$harden`, `vercel-plugin:env-vars`.

#### H2. Wallet swap sends a Bags transaction without explicit simulation or transaction preview

Evidence:

- `apps/web/components/bags/TradingPanel.tsx:157` deserializes the Bags swap transaction.
- `apps/web/components/bags/TradingPanel.tsx:161` immediately calls `sendTransaction(tx, connection, { maxRetries: 3 })`.

Impact:

A user can sign and send a Bags swap transaction without the app first showing a decoded transaction summary or running an explicit simulation. The quote UI is useful, but it is not the same as a pre-sign Solana safety review. This is a material money-moving UX and trust gap.

Recommendation:

Before wallet signing:

- Run `connection.simulateTransaction(...)` where possible.
- Show a compact confirmation surface with side, input amount, expected output, minimum output, price impact, fee payer, cluster, token mint, and program IDs.
- Surface simulation logs on failure.
- Keep wallet signing as the final user action after preview.

Suggested follow-up skills: `$solana-dev`, `$harden`, `$interaction-design`.

#### H3. Public contributor claim journey is incomplete versus the PRD

Evidence:

- `apps/web/app/(public)/u/[username]/page.tsx:68` renders the public contributor profile.
- `apps/web/app/(public)/u/[username]/page.tsx:117` shows lifetime SOL earned.
- `apps/web/app/(public)/u/[username]/page.tsx:142` shows project and earning history panels.
- The page does not expose the PRD's public "Claim earnings" CTA that should lead through GitHub OAuth and wallet linking.

Impact:

The app has dashboard earnings and admin revenue surfaces, but the public contributor path for discovering and claiming passive earnings is not complete. That is a core GitShipt product promise, not a secondary polish issue.

Recommendation:

Add a contextual claim CTA to the public contributor profile:

- If signed out: route to GitHub auth with return intent.
- If signed in but wallet unlinked: route to SIWS wallet linking.
- If eligible and linked: route to the dashboard earnings claim state.
- If no claimable earnings: show the next useful action without a dead end.

Suggested follow-up skills: `$onboard`, `$bags`, `$harden`.

### Medium

#### M1. Server-side Bags and payout transaction paths do not capture explicit simulation evidence before broadcast

Evidence:

- `apps/web/lib/bags/client.ts:401` signs Bags-provided transactions in `signAndSubmitViaBags`.
- `apps/web/lib/bags/client.ts:417` posts the serialized transaction to `solana/send-transaction`.
- `apps/web/workflows/steps/payout-helpers.ts:247` calls `bags.getClaimTransactions(...)` and signs/submits claim transactions.
- `apps/web/lib/solana/spl-transfer.ts:71` builds a SOL transfer and `apps/web/lib/solana/spl-transfer.ts:72` sends it with `sendAndConfirmTransaction`.

Impact:

The workflow has good idempotency and DB-side safety, but on-chain failures would be easier to prevent and debug if simulation logs were captured before broadcast. This matters for claim transactions, treasury flows, and recipient payout transfers.

Recommendation:

Add a shared Solana send helper that:

- Simulates before broadcast.
- Captures `err`, `logs`, and consumed units.
- Sends only after a successful simulation unless an explicitly documented override is used.
- Confirms with a blockhash-aware strategy where possible.

Suggested follow-up skills: `$solana-dev`, `$harden`.

#### M2. Global leaderboard and launch wizard are missing rendered h1 headings

Evidence:

- `apps/web/app/(public)/leaderboard/page.tsx:37` renders the page body without an `h1`.
- `apps/web/app/(public)/launch/_components/WizardShell.tsx:151` renders the launch wizard shell without an `h1`.
- Playwright smoke confirmed `h1Count: 0` for `/leaderboard` and `/launch`.

Impact:

These pages are harder to navigate with assistive technology and less semantically complete for public-facing routes.

Recommendation:

Add visible or `sr-only` `h1` headings that match each route's purpose without disturbing the layout.

Suggested follow-up skills: `$fixing-accessibility`, `$normalize`.

#### M3. Playwright e2e cannot run in the current shared dev-server state

Evidence:

- `apps/web/playwright.config.ts:12` sets `baseURL` to `http://127.0.0.1:3100`.
- `apps/web/playwright.config.ts:16` starts `next dev -- --port 3100`.
- `bun run e2e` failed because Next detected another dev server already running for the same app directory.

Impact:

The configured e2e suite is not reliable in the current local workflow. A developer with an existing app server running cannot get the regression suite to start cleanly.

Recommendation:

Make e2e explicit about its server mode:

- Either target and reuse the already-running dev server, or
- Run against a production `next start` server on a dedicated port, or
- Document/automate stopping the existing dev server before e2e.

Suggested follow-up skills: `$harden`, `$playwright-testing`.

#### M4. Mobile navigation touch targets are smaller than the audit target

Evidence:

- `packages/ui/src/sidebar.tsx:381` uses `h-9` for sidebar route items.
- `apps/web/components/sidebar/AppSidebar.tsx:674` uses `h-9` for return links.
- Mobile smoke measured repeated route controls at about 36px tall.

Impact:

The app is usable, and there was no horizontal overflow, but touch ergonomics are below the 44px target used by this audit pass.

Recommendation:

Raise mobile nav/tap target height to at least 44px while preserving the compact desktop rail density.

Suggested follow-up skills: `$adapt`, `$arrange`.

#### M5. Bags REST claim transaction fallback returns wrappers the payout helper will reject

Evidence:

- `apps/web/lib/bags/client.ts:700` uses SDK `sdk.fee.getClaimTransactions(...)` when available.
- `apps/web/lib/bags/client.ts:705` falls back to REST `token-launch/claim-txs/v3`.
- `apps/web/lib/bags/client.ts:707` parses REST items as `{ tx: unknown }`.
- `apps/web/workflows/steps/payout-helpers.ts:266` expects each item itself to be a `VersionedTransaction` or `Transaction` and throws at `apps/web/workflows/steps/payout-helpers.ts:277` otherwise.

Impact:

The SDK path appears aligned with current Bags docs, but the REST fallback is not normalized into the shape the payout helper accepts. If the SDK path is unavailable while Bags credentials are present, fee claiming can fail before signing.

Recommendation:

Normalize fallback transactions before returning from `getClaimTransactions`, or update `claimBagsFees` to unwrap and normalize `{ tx }` records through the existing transaction normalization helper.

Suggested follow-up skills: `$bags`, `$harden`.

#### M6. Enforced CSP still allows inline scripts

Evidence:

- `apps/web/next.config.ts:40` defines the enforced CSP.
- `apps/web/next.config.ts:42` includes `script-src 'self' 'unsafe-inline'`.
- `apps/web/next.config.ts:55` defines a stricter report-only policy without inline script allowance.

Impact:

The repo is transparent about this tradeoff and has report-only coverage, but the enforced policy is not at the stricter security target yet.

Recommendation:

Treat nonce-based CSP as a dedicated hardening task using `proxy.ts` nonce injection and current Next.js 16.2 docs. Do not patch this casually because it can force dynamic rendering or break App Router scripts if done partially.

Suggested follow-up skills: `$security-best-practices`, `vercel-plugin:nextjs`.

### Low

#### L1. MFA transfer input has a typo in its mono text class

Evidence:

- `apps/web/app/dashboard/projects/[id]/settings/_components/TransferForm.tsx:199` uses `text-mono-mdst`.

Impact:

The intended mono money/security input style will not apply. This is small, but it violates the repo's "mono for money / codes / signatures" design discipline.

Recommendation:

Replace `text-mono-mdst` with the intended mono text token.

Suggested follow-up skills: `$polish`.

#### L2. Dependency audit has two residual upstream advisories

Evidence:

- `bun audit` reported `bigint-buffer <=1.1.5`, high, through `@bagsfm/bags-sdk`.
- `bun audit` reported `uuid <14.0.0`, moderate, through `@solana/web3.js`.

Impact:

These are dependency-chain risks, not app-authored vulnerabilities, and the prior audit history already reduced a much larger audit set. Still, the repository cannot claim a clean dependency audit today.

Recommendation:

Track upstream fixes in Bags SDK and Solana web3.js. Avoid unsafe force-overrides that could break transaction serialization or SDK behavior.

Suggested follow-up skills: `$bags`, `$solana-dev`, `$security-best-practices`.

## Positive Findings

- The repo is a real built monorepo with public, dashboard, admin, API, workflow, DB, auth, GitHub, Bags, Solana, and shared UI boundaries in place.
- Current package pins match the repo instructions: Next.js 16.2.4, React 19.2.x, Node 22, Bun workspace, `@bagsfm/bags-sdk`, and `@solana/web3.js` v1.
- Bags integration uses the current `sdk.fee.*` namespace, not the older `sdk.feeClaim.*` naming.
- Token launch fee-share setup enforces the partner wallet/config-key pair and platform treasury address when platform fees are enabled.
- Production readiness checks correctly fail closed when required live launch variables are missing.
- External Bags responses are Zod-validated across the client surface.
- Workflow idempotency uses Vercel workflow step IDs around the external claim and payout dispatch steps.
- SIWS implementation includes short-lived nonces, Redis-backed single-use behavior in production, domain checks, chain ID validation, and signature verification.
- Payout safety includes kill switch, hot-wallet minimum balance checks, maximum payout cycle caps, and explicit workflow/audit bookkeeping.
- Theme lint passed with no raw hex in app or package source.
- The current UI is distinctive and domain-aligned rather than a generic purple gradient/card-grid interface.

## Recommended Fix Order

1. Resolve production readiness inputs for live Bags/mainnet submission.
2. Add wallet transaction preview plus explicit simulation before user-signed Bags swaps.
3. Add server-side simulation/log capture for Bags claim and payout send paths.
4. Complete the public contributor claim CTA journey.
5. Fix h1 semantics on `/leaderboard` and `/launch`.
6. Make e2e server handling reliable in shared dev sessions.
7. Normalize Bags REST claim transaction fallback shape.
8. Finish CSP nonce hardening as a dedicated security task.
9. Patch touch target sizing and the mono class typo.
10. Monitor upstream Bags SDK and Solana web3.js advisories.

## Suggested Verification After Fixes

```bash
bun run typecheck
bun run lint
bun run theme:lint
bun run test
bun run build
bun audit
bun run e2e
```

For Solana/Bags changes, also add targeted tests around:

- `bags.getClaimTransactions` SDK and REST fallback shapes.
- Transaction simulation failure display before wallet signing.
- Server claim/send helpers refusing to broadcast on failed simulation.
- Production readiness failing when partner wallet/config pairs are incomplete.

## Remediation Sweep Status

Updated: 2026-04-28 after multi-agent completion sweep.

Completed in code:

- H2: Wallet swaps now use a preview/sign split in `TradingPanel`, simulate before enabling signature, re-simulate before `sendTransaction`, and display simulation failure logs.
- H3: Public contributor profiles now include contextual claim/link CTAs for signed-out, signed-in unlinked, signed-in linked, mismatched GitHub identity, and no-earnings states.
- M1: Server Bags transaction submission and native SOL transfers now simulate before broadcast and capture simulation evidence.
- M2: `/leaderboard` and `/launch` now provide `h1` route announcements.
- M3: Playwright e2e now runs against a production `next start` server on a stable default port, with `E2E_PORT`, `E2E_BASE_URL`, and `PLAYWRIGHT_BASE_URL` overrides.
- M4: Sidebar route and return links now meet the mobile tap-target target while preserving compact desktop sizing.
- M5: Bags REST claim transaction fallback now normalizes `{ tx }` wrappers into web3 transaction instances before payout helpers consume them.
- L1: The malformed mono class on the MFA transfer input was corrected.
- Light-theme primary control contrast was repaired by giving primary controls a real `background-color`, not only layered backgrounds.
- Production variable input is now checklist-driven through `.env.production.example`, `bun run env:template`, and `bun run env:check`.
- Production readiness now also requires `GITHUB_APP_SLUG` and warns on localhost/mismatched `BETTER_AUTH_URL`.

Documented or still external:

- H1 remains an environment/deployment readiness item: production still needs real mainnet/canonical URL/Bags partner config values outside the repo, but the repo now tells operators exactly which variables are missing before launch.
- M6 remains intentionally documented rather than half-enforced. Next.js 16.2 nonce CSP requires a dedicated dynamic-rendering sweep before removing enforced `script-src 'unsafe-inline'`.
- L2 remains upstream: `bun audit` still reports `bigint-buffer` through `@bagsfm/bags-sdk` and `uuid` through `@solana/web3.js`.

Post-sweep verification:

```bash
bun run typecheck
bun run lint
bun run theme:lint
bun run test
bun run build
bun run e2e
git diff --check
```

All commands above passed. `bun audit` still fails with the two upstream advisories listed under L2.
