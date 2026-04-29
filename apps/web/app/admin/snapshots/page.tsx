import { Suspense } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { Card, CardHeader, CardTitle, CardDescription } from "@repo/ui";
import { Badge } from "@repo/ui";
import { getAllSnapshots, getSnapshotDetail } from "@/lib/queries/admin";
import { formatRelativeTime, formatSol, formatAddress } from "@repo/lib";


export default function AdminSnapshotsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <AdminSnapshotsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminSnapshotsPageContent({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const sp = await searchParams;
  await requireAdminPage("admin.access", "/admin");

  const rows = await getAllSnapshots();
  const detail = sp.id ? await getSnapshotDetail(sp.id) : null;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-headline-md">Snapshots</h1>
          <p className="text-body-sm text-fg-secondary">
            Reproducibility check: re-running scoring on a snapshot&apos;s{" "}
            `inputs` should yield the same merkle root.
          </p>
        </div>
        <Badge size="sm" variant="default">
          {rows.length}
        </Badge>
      </header>

      <Card depth="flat" padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-elevated/50 text-label-sm text-fg-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Taken</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Total fees</th>
                <th className="px-4 py-2 font-medium">Recipients</th>
                <th className="px-4 py-2 font-medium">Merkle root</th>
                <th className="px-4 py-2 font-medium">Forced</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-fg-muted"
                  >
                    No snapshots taken yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border/40 hover:bg-surface-elevated/40"
                  >
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/snapshots?id=${r.id}`}
                        className="text-fg hover:underline"
                      >
                        {r.projectSlug}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-mono-sm text-fg-muted">
                      {formatRelativeTime(r.takenAt)}
                    </td>
                    <td className="px-4 py-2">
                      <SnapStatus status={r.status} />
                    </td>
                    <td className="px-4 py-2 text-mono-sm">
                      {formatSol(r.totalFeesLamports, 4)}
                    </td>
                    <td className="px-4 py-2 text-mono-sm">
                      {r.recipientCount}
                    </td>
                    <td className="px-4 py-2 text-mono-sm" title={r.merkleRoot}>
                      {formatAddress(r.merkleRoot, 6, 6)}
                    </td>
                    <td className="px-4 py-2">
                      {r.forced ? (
                        <Badge variant="warning" size="sm">
                          forced
                        </Badge>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {detail ? <SnapshotDetailCard detail={detail} /> : null}
    </div>
  );
}

function SnapStatus({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return (
        <Badge variant="success" size="sm">
          paid
        </Badge>
      );
    case "frozen":
      return (
        <Badge variant="info" size="sm" dot>
          frozen
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="danger" size="sm">
          failed
        </Badge>
      );
    default:
      return (
        <Badge variant="default" size="sm">
          {status}
        </Badge>
      );
  }
}

function SnapshotDetailCard({
  detail,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getSnapshotDetail>>>;
}) {
  return (
    <Card depth="raised" padding="default">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-fg-muted" /> Snapshot{" "}
          {formatAddress(detail.id, 6, 6)}
        </CardTitle>
        <CardDescription>
          {detail.slug} · taken {formatRelativeTime(detail.takenAt)} · formula{" "}
          {detail.formulaVersion}
        </CardDescription>
      </CardHeader>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="space-y-1 text-body-sm">
          <p className="text-fg-secondary">Merkle root (as-stored)</p>
          <p className="text-mono-sm break-all text-fg">{detail.merkleRoot}</p>
          <p className="text-caption text-fg-muted">
            Stored with the frozen leaderboard so historical payouts remain
            reproducible.
          </p>
        </div>
        <div className="space-y-1 text-body-sm">
          <p className="text-fg-secondary">Total fees</p>
          <p className="text-mono-sm text-fg">
            {formatSol(BigInt(detail.totalFeesLamports), 4)}
          </p>
        </div>
        <div className="space-y-1 text-body-sm">
          <p className="text-fg-secondary">Status</p>
          <SnapStatus status={detail.status} />
        </div>
      </div>
      <details className="mt-4">
        <summary className="gb-menu-item inline-flex cursor-pointer rounded-md px-2 py-1 text-label-md text-fg">
          Leaderboard JSON
        </summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-md border border-border/40 bg-surface-elevated p-3 text-mono-sm text-fg-secondary">
          {JSON.stringify(detail.leaderboard, null, 2)}
        </pre>
      </details>
    </Card>
  );
}
