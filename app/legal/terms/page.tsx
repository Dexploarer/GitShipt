import type { Metadata } from "next";
import { PublicAppShell } from "@/components/public/PublicAppShell";

export const metadata: Metadata = {
  title: "Terms · GitBags",
  description: "Terms of service for GitBags (placeholder).",
};

/**
 * Placeholder terms page. Real legal copy is post-MVP — this exists so
 * the footer / signup flow can link somewhere coherent.
 */
export default function TermsPage() {
  return (
    <PublicAppShell active={undefined}>
      <article className="mx-auto flex max-w-prose flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="text-label-sm uppercase tracking-wide text-fg-muted">
            Legal
          </span>
          <h1 className="text-headline-lg tracking-tight text-fg">
            Terms of service
          </h1>
        </header>

        <div className="flex flex-col gap-4 text-body-md text-fg-secondary">
          <p>
            GitBags is a non-custodial launchpad and leaderboard for open
            source repositories. By using the service you agree that you
            are responsible for your own GitHub account, your own wallet,
            and any tokens you create or hold. The service is provided
            &ldquo;as is&rdquo; without warranty of any kind.
          </p>

          <h2 className="text-headline-sm tracking-tight text-fg">
            Intellectual property
          </h2>
          <p>
            Linking a repository to GitBags does not transfer ownership of
            the repository, its commits, or its contributors&apos;
            attribution. All IP remains with the original authors under
            the repository&apos;s declared license.
          </p>

          <h2 className="text-headline-sm tracking-tight text-fg">
            Devnet vs. mainnet
          </h2>
          <p>
            During the hackathon period and for the foreseeable beta,
            GitBags runs on Solana devnet. Devnet SOL has no monetary
            value. Mainnet activation will be announced explicitly; until
            then any token displayed in the UI is a devnet artifact.
          </p>

          <h2 className="text-headline-sm tracking-tight text-fg">
            Kill switch
          </h2>
          <p>
            GitBags reserves the right to halt payouts, freeze launches,
            or remove a project from the platform at any time via the
            platform-wide kill switch — typically in response to security
            incidents, abusive content, or legal requirements.
          </p>

          <h2 className="text-headline-sm tracking-tight text-fg">
            Liability
          </h2>
          <p>
            To the maximum extent permitted by law, the GitBags team is
            not liable for any losses, including loss of tokens, missed
            payouts, on-chain transaction failures, or third-party
            service outages (GitHub, Bags.fm, Solana RPC providers).
          </p>

          <p className="pt-4 text-body-sm text-fg-muted">
            Last updated: 2026-04-25
          </p>
        </div>
      </article>
    </PublicAppShell>
  );
}
