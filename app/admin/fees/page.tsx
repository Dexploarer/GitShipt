import { headers } from "next/headers";
import { Banknote } from "lucide-react";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPlatformConfigValue } from "@/lib/queries/admin";
import { serverEnv } from "@/lib/env";
import { FeesForm } from "./_components/FeesForm";

export const dynamic = "force-dynamic";

export default async function AdminFeesPage() {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  await requirePermission("admin.access", { userId: session.user.id });

  const stored = await getPlatformConfigValue<{ value: number; updatedBy: string }>(
    "fees.platform_bps",
  );
  const envDefault = serverEnv().PLATFORM_FEE_BPS_DEFAULT;
  const currentBps = stored?.value ?? envDefault;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md tracking-tight">Platform fees</h1>
        <p className="text-body-sm text-fg-secondary">
          Applies to every active project. Range 0–2000 bps (0–20%).
        </p>
      </header>

      <Card depth="raised" padding="default" className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="size-4 text-fg-muted" /> Platform fee BPS
          </CardTitle>
          <CardDescription>
            Destructive: changes affect every project's payout math. Reason +
            MFA + typed confirmation required.
          </CardDescription>
        </CardHeader>
        <FeesForm currentBps={currentBps} />
        <div className="mt-3 flex items-center gap-2 text-caption text-fg-muted">
          <Badge variant="default" size="sm">env default</Badge>
          <span className="text-mono-sm">{envDefault} bps</span>
        </div>
      </Card>
    </div>
  );
}
