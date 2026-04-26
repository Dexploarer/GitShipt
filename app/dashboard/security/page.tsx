import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { users } from "@/db/schema";
import { hasCredentials } from "@/lib/env";
import { getMfaConfirmedAt } from "@/lib/auth/mfa";
import { AppShell } from "../_components/AppShell";
import { AuthSidebar } from "@/components/sidebar/AuthSidebar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EnrollMfa } from "./_components/EnrollMfa";
import { VerifyMfa } from "./_components/VerifyMfa";
import { RevokeMfa } from "./_components/RevokeMfa";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  if (!hasCredentials.db()) {
    return (
      <AppShell sidebar={<AuthSidebar />}>
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
      </AppShell>
    );
  }

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/signin?next=/dashboard/security");

  const userId = session.user.id;
  const [row] = await dbHttp
    .select({ mfaSecretEnc: users.mfaSecretEnc })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const enrolled = Boolean(row?.mfaSecretEnc);

  const confirmedAtMs = enrolled ? await getMfaConfirmedAt(userId) : null;
  const confirmedIso = confirmedAtMs
    ? new Date(confirmedAtMs).toISOString()
    : null;

  return (
    <AppShell
      sidebar={
        <AuthSidebar
          user={{
            name: session.user.name ?? null,
            email: session.user.email ?? null,
            username:
              (session.user as { githubUsername?: string | null }).githubUsername ??
              null,
            imageUrl: session.user.image ?? null,
          }}
        />
      }
      footerLeft={`${session.user.name ?? session.user.email} · security`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-headline-lg leading-tight text-fg">Security</h1>
            <p className="text-body-md text-fg-secondary">
              Two-factor authentication protects destructive admin actions on
              your account.
            </p>
          </div>
          {enrolled ? (
            <Badge variant="primary" size="sm">
              <ShieldCheck className="size-3.5" /> MFA enabled
            </Badge>
          ) : (
            <Badge variant="default" size="sm">
              MFA disabled
            </Badge>
          )}
        </header>

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
                  <div className="text-label-sm uppercase tracking-wide text-fg-muted">
                    Last verified
                  </div>
                  <div className="text-mono-md text-fg">
                    {confirmedIso ?? "never (verify below)"}
                  </div>
                </section>
                <VerifyMfa />
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
    </AppShell>
  );
}
