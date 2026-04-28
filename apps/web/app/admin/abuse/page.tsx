import { ShieldAlert } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { Card, CardHeader, CardTitle, CardDescription } from "@repo/ui";
import { Badge } from "@repo/ui";
import { getAuditLogs } from "@/lib/queries/admin";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";

export const dynamic = "force-dynamic";

export default async function AdminAbusePage() {
  await requireAdminPage("admin.access", "/admin");

  const rows = await getAuditLogs({ actionPrefix: "abuse", limit: 100 });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-headline-md">Abuse</h1>
          <p className="text-body-sm text-fg-secondary">
            Explicit abuse audit records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" size="sm">
            read-only
          </Badge>
        </div>
      </header>

      {rows.length === 0 ? (
        <Card depth="flat" padding="lg" className="text-center">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center gap-2 justify-center">
              <ShieldAlert className="size-5 text-fg-muted" /> No abuse signals
            </CardTitle>
            <CardDescription>
              No `abuse.*` audit records exist yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <AuditLogViewer
          rows={rows}
          basePath="/admin/abuse"
          activePrefix="abuse"
        />
      )}
    </div>
  );
}
