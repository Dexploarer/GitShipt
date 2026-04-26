import { Database, Terminal } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui";
import { Button } from "@repo/ui";
import { Badge } from "@repo/ui";
import { getTableRowCounts } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function AdminDbPage() {
  await requireAdminPage("admin.access", "/admin");

  const tables = await getTableRowCounts();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md tracking-tight">Database</h1>
        <p className="text-body-sm text-fg-secondary">
          Read-only inventory. SQL sandbox lands in v1.1 with explicit allowlist
          + parameterized read-only role.
        </p>
      </header>

      <Card
        depth="raised"
        padding="default"
        className="flex items-center justify-between gap-3"
      >
        <div>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="size-4 text-fg-muted" /> SQL sandbox
          </CardTitle>
          <p className="mt-1 text-body-sm text-fg-secondary">
            Run read-only queries against a parameterized role. v1.1.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="warning" size="sm">
            v1.1
          </Badge>
          <Button
            variant="primary"
            size="sm"
            disabled
            title="Available in v1.1"
          >
            Open sandbox
          </Button>
        </div>
      </Card>

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
