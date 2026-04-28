import { Settings } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { Card, CardContent } from "@repo/ui";
import { EmptyState } from "@/components/shared/EmptyState";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPage("admin.access", "/admin/settings");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md">Settings</h1>
        <p className="text-body-sm text-fg-secondary">
          Platform controls grouped by operational concern.
        </p>
      </header>

      <Card depth="flat" padding="none">
        <CardContent>
          <EmptyState
            icon={Settings}
            title="Choose a settings area"
            description="Maintenance, feature flags, fees, integrations, treasury, and database controls live in their dedicated admin sections."
            cta={{ label: "Maintenance", href: "/admin/maintenance" }}
            secondary={{ label: "Feature flags", href: "/admin/feature-flags" }}
            className="py-12"
          />
        </CardContent>
      </Card>
    </div>
  );
}
