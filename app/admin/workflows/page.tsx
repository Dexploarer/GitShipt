import { headers } from "next/headers";
import { Workflow } from "lucide-react";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getHeartbeats } from "@/lib/queries/admin";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WorkflowRetriggerButton } from "./_components/WorkflowRetriggerButton";

export const dynamic = "force-dynamic";

interface WorkflowDef {
  name:
    | "healthPulse"
    | "indexGithubDeltas"
    | "computeLeaderboard"
    | "takeSnapshot"
    | "executePayout"
    | "expireEscrow"
    | "processClaim";
  schedule: string;
  needsArgs: boolean;
  description: string;
}

const WORKFLOWS: WorkflowDef[] = [
  { name: "healthPulse", schedule: "* * * * *", needsArgs: false, description: "Per-minute heartbeat tick." },
  { name: "indexGithubDeltas", schedule: "*/5 * * * *", needsArgs: false, description: "Pulls commits/PRs/reviews/issues since last cursor." },
  { name: "computeLeaderboard", schedule: "0 * * * *", needsArgs: true, description: "Re-scores every project. Manual trigger needs projectId." },
  { name: "takeSnapshot", schedule: "0 0 * * *", needsArgs: true, description: "Daily snapshot freeze. Manual trigger needs projectId." },
  { name: "executePayout", schedule: "30 0 * * *", needsArgs: true, description: "Claim + distribute. Manual trigger needs snapshotId." },
  { name: "expireEscrow", schedule: "0 1 * * *", needsArgs: false, description: "Sweep expired escrow back to platform." },
  { name: "processClaim", schedule: "(event)", needsArgs: true, description: "Drains escrow on wallet link. Event-driven, not cron." },
];

export default async function AdminWorkflowsPage() {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  await requirePermission("admin.workflows.inspect", { userId: session.user.id });

  const beats = await getHeartbeats();
  const beatsByName = new Map(beats.map((b) => [b.workflow, b]));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md tracking-tight">Workflows</h1>
        <p className="text-body-sm text-fg-secondary">
          Inspector + manual re-trigger. Full Vercel Workflows API binding ships in v1.1.
        </p>
      </header>

      <Card depth="flat" padding="none" className="overflow-hidden">
        <CardHeader className="px-4 pt-4">
          <CardTitle className="flex items-center gap-2">
            <Workflow className="size-4 text-fg-muted" /> Known workflows
          </CardTitle>
          <CardDescription>
            Heartbeat freshness: green &lt; 2m, yellow &lt; 10m, red older / never.
          </CardDescription>
        </CardHeader>
        <table className="w-full text-left text-body-sm">
          <thead className="bg-surface-elevated/50 text-label-sm text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Workflow</th>
              <th className="px-4 py-2 font-medium">Schedule</th>
              <th className="px-4 py-2 font-medium">Last beat</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Manual trigger</th>
            </tr>
          </thead>
          <tbody>
            {WORKFLOWS.map((w) => {
              const beat = beatsByName.get(w.name);
              const status = beat?.status ?? "red";
              return (
                <tr key={w.name} className="border-t border-border/40">
                  <td className="px-4 py-2">
                    <div className="text-fg">{w.name}</div>
                    <div className="text-caption text-fg-muted">{w.description}</div>
                  </td>
                  <td className="px-4 py-2 text-mono-sm text-fg-secondary">{w.schedule}</td>
                  <td className="px-4 py-2 text-mono-sm text-fg-muted">
                    {beat?.lastBeatAt ? formatRelativeTime(beat.lastBeatAt) : "never"}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          status === "green"
                            ? "bg-success"
                            : status === "yellow"
                              ? "bg-warning"
                              : "bg-danger",
                        )}
                        aria-hidden
                      />
                      {status === "green" ? (
                        <Badge variant="success" size="sm">healthy</Badge>
                      ) : status === "yellow" ? (
                        <Badge variant="warning" size="sm">stale</Badge>
                      ) : (
                        <Badge variant="danger" size="sm">cold</Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <WorkflowRetriggerButton name={w.name} disabled={w.needsArgs} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
