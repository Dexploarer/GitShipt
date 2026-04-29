# Security Policy

GitShipt processes Solana transactions and is intended for production use.
We take security reports seriously and ask that you follow the process below.

## Reporting a vulnerability

**Do not file public GitHub issues for security findings.**

Please email **security@gitshipt.com** with:

- A brief description of the vulnerability and its impact.
- Steps to reproduce, including any required state, payloads, or accounts.
- The affected component (route, library, workflow) if known.
- Whether you require coordinated disclosure before publication.

We respond within **2 business days**, with an initial assessment within
**5 business days**. If your report identifies a verified vulnerability, we
provide an estimated remediation timeline and a coordinated disclosure date.

For PGP-encrypted submissions, request our key via the same address.

## Scope

In scope:

- Code in this repository (apps/web, packages/*).
- Security configuration shipped in this repository (CSP, headers,
  Vercel cron auth, RLS policies).
- Infrastructure that handles money: payout dispatch, fee-share update,
  fund reconciliation, escrow, kill-switch, MFA, and admin destructive
  actions.
- Public APIs under `/api/*`.

Out of scope:

- Stub-mode behaviour exercised when production credentials are absent.
- Self-hosted instances running modifications not present in this repo.
- Third-party services (Bags.fm, Helius, GitHub) — please report directly
  to the vendor.
- Any test or seed data — including the demo project — which is gated
  behind `ALLOW_DEMO_SEED` and `NODE_ENV !== "production"`.

## Severity classification

We use a slightly tightened version of CVSS v3.1 oriented to financial
flows:

- **Critical**: unauthenticated theft, kill-switch bypass, replay of a
  signed payout, or RLS bypass that returns another tenant's data.
- **High**: authenticated privilege escalation, MFA bypass, ability to
  forge or replay a webhook, audit-log tampering, idempotency-cache
  integrity bypass.
- **Medium**: cross-site scripting, request smuggling, SSRF without
  data exfiltration, rate-limit bypass on auth.
- **Low**: information disclosure of non-sensitive details, missing
  hardening flags, defense-in-depth issues.

## Bounty

GitShipt does not currently run a paid bug-bounty program. Verified
findings are credited (with permission) in the security advisory and
release notes for the fix.

## Hall of fame

Researchers who have helped us fix issues — once we have any confirmed
disclosures, they will be listed here with their permission.
