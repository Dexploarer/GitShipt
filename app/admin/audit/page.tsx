import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
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
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  await requirePermission("admin.audit.read", { userId: session.user.id });

  const sinceHours = sp.sinceHours ? Number(sp.sinceHours) : 24;
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;
  const rows = await getAuditLogs({ actionPrefix: sp.prefix, sinceMs, limit: 500 });

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
