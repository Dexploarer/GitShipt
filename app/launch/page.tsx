import { hasCredentials } from "@/lib/env";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import { getSessionUser } from "@/lib/auth/session";
import { WizardShell } from "./_components/WizardShell";

function isStubMode(): boolean {
  // Stub mode = no Bags API key configured. Surface a "test mode" banner in
  // the wizard so users know the launch will be a fake mint.
  try {
    return !hasCredentials.bags();
  } catch {
    return true;
  }
}

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
  const user = await getSessionUser();
  const signedIn = Boolean(user);

  return (
    <PublicAppShell user={user} footerLeft="Launch a token · devnet · BAGS.fm">
      <WizardShell signedIn={signedIn} isStubMode={isStubMode()} />
    </PublicAppShell>
  );
}
