import { hasCredentials } from "@/lib/env";
import { requireAuthSession } from "@/lib/auth/session";
import { getMfaConfirmedAt } from "@/lib/auth/mfa";
import { getAccountSecurityState } from "@/lib/queries/account";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui";
import { EnrollMfa } from "./_components/EnrollMfa";
import { VerifyMfa } from "./_components/VerifyMfa";
import { RevokeMfa } from "./_components/RevokeMfa";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  if (!hasCredentials.db()) {
    return (
      <div className="mx-auto w-full max-w-content">
        <Card>
          <CardHeader>
            <CardTitle>Stub mode</CardTitle>
            <CardDescription>
              Set DATABASE_URL to manage security settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const session = await requireAuthSession("/dashboard/security");

  const userId = session.user.id;
  const security = await getAccountSecurityState(userId);
  const enrolled = Boolean(security?.mfaEnrolled);

  const confirmedAtMs = enrolled ? await getMfaConfirmedAt(userId) : null;
  const confirmedIso = confirmedAtMs
    ? new Date(confirmedAtMs).toISOString()
    : null;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Authenticator app</CardTitle>
          <CardDescription>
            {enrolled
              ? "Your account is protected by a TOTP authenticator. Re-confirm any time within the last 5 minutes to take a destructive action."
              : "Pair a TOTP app (Google Authenticator, 1Password, Authy) to unlock destructive admin operations."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {enrolled ? (
            <>
              <section className="flex flex-col gap-2">
                <div className="text-label-sm uppercase text-fg-muted">
                  Last verified
                </div>
                <div className="text-mono-md text-fg">
                  {confirmedIso ?? "never (verify below)"}
                </div>
              </section>
              <VerifyMfa />
              {!confirmedIso ? (
                <div className="border-t border-border pt-6">
                  <EnrollMfa mode="regenerate" />
                </div>
              ) : null}
              <div className="border-t border-border pt-6">
                <RevokeMfa />
              </div>
            </>
          ) : (
            <EnrollMfa />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
