import { Workflow } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui";
import { Badge } from "@repo/ui";
import { getHeartbeats } from "@/lib/queries/admin";
import { formatRelativeTime } from "@repo/lib";
import { cn } from "@repo/lib";
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
    | "processClaim"
    | "publishKpis";
  heartbeatKey: string | null;
  schedule: string;
  needsArgs: boolean;
  description: string;
}

const WORKFLOWS: WorkflowDef[] = [
  {
    name: "healthPulse",
    heartbeatKey: "runtime",
    schedule: "* * * * *",
    needsArgs: false,
    description: "Per-minute heartbeat tick.",
  },
  {
    name: "indexGithubDeltas",
    heartbeatKey: "indexer",
    schedule: "*/5 * * * *",
    needsArgs: false,
    description: "Pulls commits/PRs/reviews/issues since last cursor.",
  },
  {
    name: "computeLeaderboard",
    heartbeatKey: "leaderboard",
    schedule: "0 * * * *",
    needsArgs: true,
    description: "Re-scores every project. Manual trigger needs projectId.",
  },
  {
    name: "takeSnapshot",
    heartbeatKey: "snapshot",
    schedule: "0 0 * * *",
    needsArgs: false,
    description: "Daily snapshot freeze. Per-project trigger lives on project pages.",
  },
  {
    name: "executePayout",
    heartbeatKey: "payouts",
    schedule: "30 0 * * *",
    needsArgs: false,
    description: "Claim + distribute all frozen snapshots awaiting payout.",
  },
  {
    name: "expireEscrow",
    heartbeatKey: "escrow",
    schedule: "0 1 * * *",
    needsArgs: false,
    description: "Sweep expired escrow back to platform.",
  },
  {
    name: "publishKpis",
    heartbeatKey: null,
    schedule: "* * * * *",
    needsArgs: false,
    description: "Publish the cached public landing ticker.",
  },
  {
    name: "processClaim",
    heartbeatKey: null,
    schedule: "(event)",
    needsArgs: true,
    description: "Drains escrow on wallet link. Event-driven, not cron.",
  },
];

export default async function AdminWorkflowsPage() {
  await requireAdminPage("admin.workflows.inspect", "/admin/workflows");

  const beats = await getHeartbeats();
  const beatsByName = new Map(beats.map((b) => [b.workflow, b]));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md tracking-tight">Workflows</h1>
        <p className="text-body-sm text-fg-secondary">
          Inspector and manual re-trigger surface for the cron-backed workflow
          runs.
        </p>
      </header>

      <Card depth="flat" padding="none" className="overflow-hidden">
        <CardHeader className="px-4 pt-4">
          <CardTitle className="flex items-center gap-2">
            <Workflow className="size-4 text-fg-muted" /> Known workflows
          </CardTitle>
          <CardDescription>
            Heartbeat freshness: green &lt; 2m, yellow &lt; 10m, red older /
            never.
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
              const beat = w.heartbeatKey
                ? beatsByName.get(w.heartbeatKey)
                : undefined;
              const status = beat?.status ?? "red";
              return (
                <tr key={w.name} className="border-t border-border/40">
                  <td className="px-4 py-2">
                    <div className="text-fg">{w.name}</div>
                    <div className="text-caption text-fg-muted">
                      {w.description}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-mono-sm text-fg-secondary">
                    {w.schedule}
                  </td>
                  <td className="px-4 py-2 text-mono-sm text-fg-muted">
                    {beat?.lastBeatAt
                      ? formatRelativeTime(beat.lastBeatAt)
                      : "never"}
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
                        <Badge variant="success" size="sm">
                          healthy
                        </Badge>
                      ) : status === "yellow" ? (
                        <Badge variant="warning" size="sm">
                          stale
                        </Badge>
                      ) : (
                        <Badge variant="danger" size="sm">
                          cold
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <WorkflowRetriggerButton
                      name={w.name}
                      disabled={w.needsArgs}
                    />
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
