import Link from "next/link";
import { Layers } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill } from "@/components/ui/pill";
import { getAllProjects } from "@/lib/queries/admin";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "live", label: "Live" },
  { key: "paused", label: "Paused" },
  { key: "killed", label: "Killed" },
] as const;

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "all";

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  await requirePermission("admin.access", { userId: session.user.id });

  const rows = await getAllProjects({ status });

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-md tracking-tight">Projects</h1>
          <p className="text-body-sm text-fg-secondary">
            Every project on the platform. Click a row to open the god-mode view.
          </p>
        </div>
        <Badge variant="default" size="sm">
          {rows.length} total
        </Badge>
      </header>

      <div className="flex items-center gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const href = f.key === "all" ? "/admin/projects" : `/admin/projects?status=${f.key}`;
          const active = status === f.key;
          return (
            <a key={f.key} href={href}>
              <Pill variant={active ? "primary" : "neutral"} size="sm" interactive>
                {f.label}
              </Pill>
            </a>
          );
        })}
      </div>

      <Card depth="flat" padding="none" className="overflow-hidden">
        <CardHeader className="px-4 pt-4">
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4 text-fg-muted" /> {rows.length} projects
          </CardTitle>
          <CardDescription>
            Bulk pause / kill is wired through the per-project page; multi-select
            here is v1.1.
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-elevated/50 text-label-sm text-fg-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Contributors</th>
                <th className="px-4 py-2 font-medium">Token mint</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-fg-muted">
                    No projects match this filter.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-border/40 hover:bg-surface-elevated/40"
                  >
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="flex min-w-0 items-center gap-2"
                      >
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="size-6 shrink-0 rounded-md"
                          />
                        ) : (
                          <span className="size-6 shrink-0 rounded-md bg-surface-elevated" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-fg">{p.name}</span>
                          <span className="block truncate text-mono-sm text-fg-muted">
                            {p.slug}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-fg-secondary">
                      {p.ownerUsername ?? p.ownerName ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-2 text-mono-sm">{p.contributorsCount}</td>
                    <td className="px-4 py-2 text-mono-sm text-fg-muted">
                      {p.tokenMint ? `${p.tokenMint.slice(0, 6)}...${p.tokenMint.slice(-4)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-mono-sm text-fg-muted">
                      {formatRelativeTime(p.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "live" | "paused" | "killed" }) {
  switch (status) {
    case "live":
      return <Badge variant="success" size="sm" dot>Live</Badge>;
    case "paused":
      return <Badge variant="warning" size="sm">Paused</Badge>;
    case "killed":
      return <Badge variant="danger" size="sm">Killed</Badge>;
    default:
      return <Badge variant="default" size="sm">Draft</Badge>;
  }
}
