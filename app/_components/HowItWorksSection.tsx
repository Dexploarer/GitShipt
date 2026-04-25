import { Coins, Github, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

/**
 * Three-step explainer that anchors the bottom of the marketing fold.
 * Floating cards (depth=flat) so the section reads as supporting detail
 * — the Top Projects grid above carries the visual weight.
 */
const STEPS = [
  {
    n: 1,
    title: "Connect your repo",
    Icon: Github,
    body: "Sign in with GitHub, pick a repo, configure your leaderboard.",
  },
  {
    n: 2,
    title: "Launch the token",
    Icon: Sparkles,
    body: "We mint a Bags.fm token tied to your repo. Trading begins immediately.",
  },
  {
    n: 3,
    title: "Daily payouts",
    Icon: Coins,
    body: "Top 10 contributors get tier-weighted SOL transfers, every day at 00:30 UTC.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-headline-md tracking-tight text-fg">
          How it works
        </h2>
        <p className="text-body-md text-fg-secondary">
          Three steps from a public repo to on-chain payouts.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STEPS.map(({ n, title, body, Icon }) => (
          <Card key={n} depth="flat" padding="lg" className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-10 place-items-center rounded-md bg-surface-elevated text-fg-secondary"
              >
                <Icon className="size-5" />
              </span>
              <span className="text-mono-sm text-fg-muted">
                Step {n}
              </span>
            </div>
            <CardContent className="flex flex-col gap-2">
              <CardTitle>{title}</CardTitle>
              <CardDescription className="text-body-md text-fg-secondary">
                {body}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
