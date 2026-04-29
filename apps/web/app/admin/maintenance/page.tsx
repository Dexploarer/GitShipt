import { Suspense } from "react";
import { Power } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { Card, CardHeader, CardTitle, CardDescription } from "@repo/ui";
import { Badge } from "@repo/ui";
import { getPlatformConfigValue } from "@/lib/queries/admin";
import { KillSwitchPanel } from "./_components/KillSwitchPanel";
import { BannerForm } from "./_components/BannerForm";


export default function AdminMaintenancePage() {
  return (
    <Suspense fallback={null}>
      <AdminMaintenancePageContent />
    </Suspense>
  );
}

async function AdminMaintenancePageContent() {
  await requireAdminPage("platform.maintenance", "/admin/maintenance");

  const ks = await getPlatformConfigValue<{
    enabled?: boolean;
    reason?: string;
    toggledBy?: string;
  }>("kill_switch.global");
  const banner = await getPlatformConfigValue<{
    message?: string;
    visible?: boolean;
  }>("banner.global");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md">Maintenance</h1>
        <p className="text-body-sm text-fg-secondary">
          Kill switch + banner. The switch is checked at the top of every cron
          entry-point.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card depth="raised" padding="default" className="border-danger/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className="size-4 text-danger" /> Kill switch
            </CardTitle>
            <CardDescription>
              Halts every workflow. Destructive: requires reason + MFA + typed
              confirmation.
            </CardDescription>
          </CardHeader>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-label-sm text-fg-secondary">Current</span>
              {ks?.enabled ? (
                <Badge variant="danger" dot>
                  ENABLED
                </Badge>
              ) : (
                <Badge variant="success" dot>
                  disabled
                </Badge>
              )}
            </div>
            {ks?.reason ? (
              <p className="rounded-md border border-border/40 bg-surface-elevated/50 px-3 py-2 text-body-sm text-fg-secondary">
                <span className="text-label-sm text-fg-muted">
                  last reason:{" "}
                </span>
                {ks.reason}
              </p>
            ) : null}
            <KillSwitchPanel currentEnabled={Boolean(ks?.enabled)} />
          </div>
        </Card>

        <Card depth="raised" padding="default">
          <CardHeader>
            <CardTitle>Global banner</CardTitle>
            <CardDescription>Public incident copy.</CardDescription>
          </CardHeader>
          <BannerForm
            initialMessage={banner?.message ?? ""}
            initialVisible={Boolean(banner?.visible)}
          />
        </Card>
      </section>
    </div>
  );
}
