import { ShieldAlert } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui";
import { getAuditLogs } from "@/lib/queries/admin";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";

export const dynamic = "force-dynamic";

export default async function AdminAbusePage() {
  await requireAdminPage("admin.access", "/admin");

  const rows = await getAuditLogs({ actionPrefix: "abuse", limit: 100 });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md tracking-tight">Abuse</h1>
        <p className="text-body-sm text-fg-secondary">
          Surfaces audit_log entries with action prefix `abuse.` Today this is
          empty by design — v1.1 wires sybil + spam detectors that emit here.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card depth="flat" padding="lg" className="text-center">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center gap-2 justify-center">
              <ShieldAlert className="size-5 text-fg-muted" /> No abuse signals
            </CardTitle>
            <CardDescription>
              Sybil-flagged user actions and abuse heuristics will appear here
              once the v1.1 detectors are live.
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
