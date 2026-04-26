import { requireAdminPage } from "@/lib/auth/page-guards";
import { getAuditLogs } from "@/lib/queries/admin";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { ExportAuditButton } from "./_components/ExportAuditButton";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ prefix?: string; sinceHours?: string }>;
}) {
  const sp = await searchParams;
  await requireAdminPage("admin.audit.read", "/admin/audit");

  const sinceHours = sp.sinceHours ? Number(sp.sinceHours) : 24;
  // eslint-disable-next-line react-hooks/purity -- Dynamic admin page computes a rolling audit window.
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;
  const rows = await getAuditLogs({
    actionPrefix: sp.prefix,
    sinceMs,
    limit: 500,
  });

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-headline-md tracking-tight">Audit log</h1>
          <p className="text-body-sm text-fg-secondary">
            Last {sinceHours}h · {rows.length} entries · append-only.
          </p>
        </div>
        <ExportAuditButton prefix={sp.prefix} sinceMs={sinceMs} />
      </header>

      <AuditLogViewer
        rows={rows}
        activePrefix={sp.prefix ?? "all"}
        basePath="/admin/audit"
      />
    </div>
  );
}
