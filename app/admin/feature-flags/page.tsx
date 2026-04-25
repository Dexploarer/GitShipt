import { headers } from "next/headers";
import { Flag } from "lucide-react";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPlatformConfigValue } from "@/lib/queries/admin";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  await requirePermission("admin.access", { userId: session.user.id });

  const env = serverEnv();
  const ks = await getPlatformConfigValue<{ enabled?: boolean }>("kill_switch.global");
  const flags = [
    {
      key: "payouts.dry_run",
      enabled: false,
      source: "default",
      detail: "Refuses to broadcast on-chain transactions. Toggle ships in v1.1.",
    },
    {
      key: "kill_switch.global",
      enabled: Boolean(ks?.enabled),
      source: "platform_config",
      detail: "Master halt — every workflow checks this on entry. Toggle in /admin/maintenance.",
    },
    {
      key: "enable_bags_prod_launch",
      enabled: env.BAGS_ALLOW_PROD_LAUNCH,
      source: "env: BAGS_ALLOW_PROD_LAUNCH",
      detail: "Allows mainnet-keyed Bags launches on non-mainnet clusters. Env-controlled.",
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md tracking-tight">Feature flags</h1>
        <p className="text-body-sm text-fg-secondary">
          Read-only inventory for v0. Cohort + targeted rollouts ship in v1.1.
        </p>
      </header>

      <Card depth="flat" padding="none" className="overflow-hidden">
        <CardHeader className="px-4 pt-4">
          <CardTitle className="flex items-center gap-2">
            <Flag className="size-4 text-fg-muted" /> Inventory
          </CardTitle>
          <CardDescription>{flags.length} flags</CardDescription>
        </CardHeader>
        <table className="w-full text-left text-body-sm">
          <thead className="bg-surface-elevated/50 text-label-sm text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Key</th>
              <th className="px-4 py-2 font-medium">State</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.key} className="border-t border-border/40">
                <td className="px-4 py-2 text-mono-sm">{f.key}</td>
                <td className="px-4 py-2">
                  {f.enabled ? (
                    <Badge variant="success" size="sm" dot>on</Badge>
                  ) : (
                    <Badge variant="default" size="sm">off</Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-mono-sm text-fg-secondary">{f.source}</td>
                <td className="px-4 py-2 text-fg-secondary">{f.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
