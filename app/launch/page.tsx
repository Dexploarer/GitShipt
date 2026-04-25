import Link from "next/link";
import { headers } from "next/headers";
import { Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasCredentials } from "@/lib/env";
import { ThemeToggle } from "@/components/theme-toggle";
import { WizardShell } from "./_components/WizardShell";

export const metadata = {
  title: "Launch a token",
  description:
    "Pick a GitHub repo, configure metadata and the leaderboard, and launch a Bags.fm token.",
};

export const dynamic = "force-dynamic";

/**
 * /launch — entry point for the launch wizard.
 *
 * Auth model: any authed user can land here. The `<WizardShell>` itself is a
 * client component that drives the 4 steps. Server-side we just resolve the
 * session so the shell knows whether to render the sign-in CTA.
 */
export default async function LaunchPage() {
  const signedIn = await isSignedIn();

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-margin">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-bg">
              <Sparkles className="size-4" />
            </span>
            <span className="text-headline-sm tracking-tight">GitBags</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/explore"
              className="rounded-md px-3 py-2 text-label-md text-fg-secondary transition-colors hover:bg-surface-elevated hover:text-fg"
            >
              Explore
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="px-margin">
        <WizardShell signedIn={signedIn} />
      </main>
    </div>
  );
}

async function isSignedIn(): Promise<boolean> {
  // Stub mode (no DB) — we still render the wizard but the shell will show
  // the sign-in CTA, which is the correct behavior since no auth backend is
  // available either.
  if (!hasCredentials.db()) return false;
  try {
    const session = await auth().api.getSession({
      headers: await headers(),
    });
    return Boolean(session?.user?.id);
  } catch {
    return false;
  }
}
