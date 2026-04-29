import { Suspense } from "react";
import { Database } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { Card, CardHeader, CardTitle, CardDescription } from "@repo/ui";
import { Badge } from "@repo/ui";
import { getTableRowCounts } from "@/lib/queries/admin";


export default function AdminDbPage() {
  return (
    <Suspense fallback={null}>
      <AdminDbPageContent />
    </Suspense>
  );
}

async function AdminDbPageContent() {
  await requireAdminPage("admin.access", "/admin");

  const tables = await getTableRowCounts();

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-headline-md">Database</h1>
          <p className="text-body-sm text-fg-secondary">
            Live read-only inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm" dot>
            row counts live
          </Badge>
        </div>
      </header>

      <Card depth="flat" padding="none" className="overflow-hidden">
        <CardHeader className="px-4 pt-4">
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4 text-fg-muted" /> Tables
          </CardTitle>
          <CardDescription>
            Row counts use Postgres `reltuples` estimates — fast but not exact.
          </CardDescription>
        </CardHeader>
        <table className="w-full text-left text-body-sm">
          <thead className="bg-surface-elevated/50 text-label-sm text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Table</th>
              <th className="px-4 py-2 font-medium">Rows (est.)</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t.table} className="border-t border-border/40">
                <td className="px-4 py-2 text-mono-sm">{t.table}</td>
                <td className="px-4 py-2 text-mono-sm text-fg-secondary">
                  {t.rows.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
