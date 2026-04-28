import { getAuthSession } from "@/lib/auth/session";
import { getLaunchWizardConfig } from "@/lib/queries/launch";
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
 * Mounts inside `<PublicAppShell>` so the wizard sits under the same
 * sidebar/footer chrome as every other surface (Public + Account groups
 * when signed in, Get-started + Sign-in CTA when not).
 *
 * Auth model: any visitor can land here. The `<WizardShell>` itself is a
 * client component that drives the 4 steps; we resolve the session
 * server-side so the shell knows whether to render the sign-in CTA.
 */
export default async function LaunchPage() {
  const [session, config] = await Promise.all([
    getAuthSession(),
    getLaunchWizardConfig(),
  ]);
  const signedIn = Boolean(session?.user);

  return <WizardShell signedIn={signedIn} isStubMode={config.isStubMode} />;
}
