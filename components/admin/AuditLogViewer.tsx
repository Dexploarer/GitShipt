import * as React from "react";
import { FileSearch } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, formatAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditRow } from "@/lib/queries/admin";

const PREFIXES = [
  { key: "all", label: "All" },
  { key: "auth", label: "Auth" },
  { key: "project", label: "Projects" },
  { key: "payout", label: "Payouts" },
  { key: "snapshot", label: "Snapshots" },
  { key: "fees", label: "Fees" },
  { key: "kill_switch", label: "Kill switch" },
  { key: "user", label: "Users" },
  { key: "admin", label: "Admin" },
  { key: "treasury", label: "Treasury" },
  { key: "abuse", label: "Abuse" },
] as const;

/**
 * Server-rendered audit log table with filter chips. The chips are rendered
 * as `<Link>`s so server actions are unnecessary — the page consumes the
 * `?prefix=` searchParam.
 */
export function AuditLogViewer({
  rows,
  activePrefix = "all",
  basePath = "/admin/audit",
}: {
  rows: AuditRow[];
  activePrefix?: string;
  basePath?: string;
}) {
  return (
    <Card depth="flat" padding="sm" className="space-y-3">
      <CardHeader className="px-2 pt-1">
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="size-4 text-fg-muted" /> Audit log
        </CardTitle>
        <CardDescription>
          Append-only. The application DB role does not have UPDATE / DELETE on
          this table.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-wrap items-center gap-1.5 px-2">
        {PREFIXES.map((p) => {
          const href =
            p.key === "all"
              ? basePath
              : `${basePath}?prefix=${encodeURIComponent(p.key)}`;
          const active = activePrefix === p.key;
          return (
            <a key={p.key} href={href}>
              <Pill
                variant={active ? "primary" : "neutral"}
                size="sm"
                interactive
              >
                {p.label}
              </Pill>
            </a>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-body-sm text-fg-muted">
          No audit entries match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="text-label-sm text-fg-muted">
              <tr className="border-b border-border/60">
                <th className="px-2 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Actor</th>
                <th className="px-2 py-2 font-medium">Action</th>
                <th className="px-2 py-2 font-medium">Target</th>
                <th className="px-2 py-2 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <AuditRowEl key={r.id} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function AuditRowEl({ row }: { row: AuditRow }) {
  const variant = actionVariant(row.action);
  const targetShort = row.targetId.length > 12 ? formatAddress(row.targetId, 6, 4) : row.targetId;

  return (
    <tr className="border-b border-border/30 hover:bg-surface-elevated/40">
      <td
        className="whitespace-nowrap px-2 py-2 text-mono-sm text-fg-secondary"
        title={row.createdAt.toISOString()}
      >
        {formatRelativeTime(row.createdAt)}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          {row.actorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.actorAvatar}
              alt=""
              className="size-5 shrink-0 rounded-full"
            />
          ) : (
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-elevated text-caption text-fg-muted">
              {(row.actorName ?? "·").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-fg">
            {row.actorName ?? <span className="text-fg-muted">system</span>}
          </span>
        </div>
      </td>
      <td className="px-2 py-2">
        <Badge variant={variant} size="sm">
          {row.action}
        </Badge>
      </td>
      <td className="px-2 py-2 text-mono-sm text-fg-secondary">
        <span title={`${row.targetType}:${row.targetId}`}>
          <span className="text-fg-muted">{row.targetType}:</span>
          {targetShort}
        </span>
      </td>
      <td className="max-w-[20rem] px-2 py-2 align-top">
        <details className="group">
          <summary className={cn(
            "cursor-pointer list-none text-caption text-fg-muted",
            "group-open:text-fg-secondary",
          )}>
            {Object.keys(row.metadata).length > 0
              ? `${Object.keys(row.metadata).length} keys`
              : "—"}
          </summary>
          {Object.keys(row.metadata).length > 0 ? (
            <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-border/50 bg-surface-elevated p-2 text-mono-sm text-fg-secondary">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          ) : null}
        </details>
      </td>
    </tr>
  );
}

function actionVariant(action: string): "default" | "primary" | "success" | "warning" | "danger" | "info" {
  if (action.startsWith("payout")) return "info";
  if (action.startsWith("project.kill") || action.startsWith("kill_switch")) return "danger";
  if (action.startsWith("project.pause") || action.startsWith("project.delete")) return "warning";
  if (action.startsWith("auth")) return "primary";
  if (action.startsWith("snapshot")) return "info";
  if (action.startsWith("fees") || action.startsWith("treasury")) return "warning";
  return "default";
}
