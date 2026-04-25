import type { Metadata } from "next";
import { PublicAppShell } from "@/components/public/PublicAppShell";

export const metadata: Metadata = {
  title: "Privacy · GitBags",
  description: "Privacy policy for GitBags (placeholder).",
};

/**
 * Placeholder privacy page. Real legal copy is post-MVP — this exists so
 * the footer / signup flow can link somewhere coherent.
 */
export default function PrivacyPage() {
  return (
    <PublicAppShell active={undefined}>
      <article className="mx-auto flex max-w-prose flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="text-label-sm uppercase tracking-wide text-fg-muted">
            Legal
          </span>
          <h1 className="text-headline-lg tracking-tight text-fg">
            Privacy policy
          </h1>
        </header>

        <div className="flex flex-col gap-4 text-body-md text-fg-secondary">
          <p>
            GitBags collects only the data required to operate the
            launchpad: your public GitHub identity, the repositories you
            link, the wallet address you sign in with, and the public
            on-chain transactions we issue on your behalf. We do not run
            any KYC checks and we do not collect government identity.
          </p>

          <h2 className="text-headline-sm tracking-tight text-fg">
            GitHub OAuth scope
          </h2>
          <p>
            We request the <code className="text-mono-sm text-fg">read:user</code>{" "}
            scope to read your username, email, and avatar, plus the
            <code className="text-mono-sm text-fg"> public_repo</code> scope to list
            and reference your public repositories. We never request
            write access to your code.
          </p>

          <h2 className="text-headline-sm tracking-tight text-fg">
            Wallet addresses
          </h2>
          <p>
            Wallet addresses you link via SIWS are stored in our
            database alongside your GitHub user ID. They are public
            information by design — required to send you payouts. We do
            not transmit them to any third party other than the public
            Solana RPC endpoints used to broadcast transactions.
          </p>

          <h2 className="text-headline-sm tracking-tight text-fg">
            Audit log retention
          </h2>
          <p>
            Administrative actions (payouts, kill switches, fee changes)
            are recorded in an append-only audit log retained for a
            minimum of 12 months. The log contains the actor identifier,
            the action, and the affected resource — never your private
            data.
          </p>

          <h2 className="text-headline-sm tracking-tight text-fg">
            Third-party services
          </h2>
          <p>
            We rely on Vercel for hosting, Neon for Postgres, GitHub for
            authentication and event ingestion, and Bags.fm for token
            launches. Each has their own privacy policy that applies to
            the data they handle on our behalf.
          </p>

          <h2 className="text-headline-sm tracking-tight text-fg">
            Contact
          </h2>
          <p>
            Questions about this policy? Email{" "}
            <a
              href="mailto:privacy@gitbags.xyz"
              className="text-fg underline-offset-4 hover:underline"
            >
              privacy@gitbags.xyz
            </a>{" "}
            (placeholder — production address will be set before mainnet
            launch).
          </p>

          <p className="pt-4 text-body-sm text-fg-muted">
            Last updated: 2026-04-25
          </p>
        </div>
      </article>
    </PublicAppShell>
  );
}
