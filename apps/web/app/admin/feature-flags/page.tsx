import { Flag } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { Card, CardHeader, CardTitle, CardDescription } from "@repo/ui";
import { Badge } from "@repo/ui";
import { getPlatformConfigValue } from "@/lib/queries/admin";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  await requireAdminPage("admin.access", "/admin");

  const env = serverEnv();
  const ks = await getPlatformConfigValue<{ enabled?: boolean }>(
    "kill_switch.global",
  );
  const flags = [
    {
      key: "payouts.dry_run",
      enabled: false,
      source: "default",
      control: "Coming soon - no runtime toggle",
      detail:
        "Dry-run mode is documented only in v0. Payout safety is enforced by workflow guards and env credentials today.",
    },
    {
      key: "kill_switch.global",
      enabled: Boolean(ks?.enabled),
      source: "platform_config",
      control: "Live control in /admin/maintenance",
      detail:
        "Master halt — every workflow checks this on entry. Toggle in /admin/maintenance.",
    },
    {
      key: "enable_bags_prod_launch",
      enabled: env.BAGS_ALLOW_PROD_LAUNCH,
      source: "env: BAGS_ALLOW_PROD_LAUNCH",
      control: "Manual deploy/env change",
      detail:
        "Allows mainnet-keyed Bags launches on non-mainnet clusters. Env-controlled.",
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-headline-md tracking-tight">Feature flags</h1>
          <p className="text-body-sm text-fg-secondary">
            Read-only inventory for v0. This page shows current state and where
            each flag is changed; it is not a flag editor yet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" size="sm">
            read-only
          </Badge>
          <Badge variant="warning" size="sm">
            targeted rollout UI coming soon
          </Badge>
        </div>
      </header>

      <Card depth="flat" padding="none" className="overflow-hidden">
        <CardHeader className="px-4 pt-4">
          <CardTitle className="flex items-center gap-2">
            <Flag className="size-4 text-fg-muted" /> Inventory
          </CardTitle>
          <CardDescription>{flags.length} flags</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-body-sm">
            <thead className="bg-surface-elevated/50 text-label-sm text-fg-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-4 py-2 font-medium">State</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Control</th>
                <th className="px-4 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.key} className="border-t border-border/40">
                  <td className="px-4 py-2 text-mono-sm">{f.key}</td>
                  <td className="px-4 py-2">
                    {f.enabled ? (
                      <Badge variant="success" size="sm" dot>
                        on
                      </Badge>
                    ) : (
                      <Badge variant="default" size="sm">
                        off
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-mono-sm text-fg-secondary">
                    {f.source}
                  </td>
                  <td className="px-4 py-2 text-fg-secondary">{f.control}</td>
                  <td className="px-4 py-2 text-fg-secondary">{f.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
