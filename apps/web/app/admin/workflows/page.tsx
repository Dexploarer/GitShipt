import { Workflow } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { Card, CardHeader, CardTitle, CardDescription } from "@repo/ui";
import { Badge } from "@repo/ui";
import { getHeartbeats } from "@/lib/queries/admin";
import { formatRelativeTime } from "@repo/lib";
import { cn } from "@repo/lib";
import vercelConfig from "../../../../../vercel.json";
import { WorkflowRetriggerButton } from "./_components/WorkflowRetriggerButton";

export const dynamic = "force-dynamic";

type WorkflowName =
  | "healthPulse"
  | "indexGithubDeltas"
  | "computeLeaderboard"
  | "takeSnapshot"
  | "executePayout"
  | "expireEscrow"
  | "processClaim"
  | "publishKpis";

type ManualTrigger =
  | {
      kind: "enabled";
      label: "No args";
      detail: string;
    }
  | {
      kind: "project";
      label: "Project ID required";
      detail: string;
    }
  | {
      kind: "event";
      label: "Event payload required";
      detail: string;
    };

interface WorkflowDef {
  name: WorkflowName;
  heartbeatKey: string | null;
  cronPath: string | null;
  fallbackSchedule: string;
  manual: ManualTrigger;
  description: string;
}

const CRON_BY_PATH = new Map(
  vercelConfig.crons.map((cron) => [cron.path, cron.schedule] as const),
);

const WORKFLOWS: WorkflowDef[] = [
  {
    name: "healthPulse",
    heartbeatKey: "runtime",
    cronPath: "/api/cron/health",
    fallbackSchedule: "* * * * *",
    manual: {
      kind: "enabled",
      label: "No args",
      detail: "Queues the same root heartbeat workflow used by cron.",
    },
    description: "Per-minute heartbeat tick.",
  },
  {
    name: "indexGithubDeltas",
    heartbeatKey: "indexer",
    cronPath: "/api/cron/index-github",
    fallbackSchedule: "*/15 * * * *",
    manual: {
      kind: "enabled",
      label: "No args",
      detail: "Queues the root GitHub indexer for all eligible projects.",
    },
    description: "Pulls commits/PRs/reviews/issues since last cursor.",
  },
  {
    name: "computeLeaderboard",
    heartbeatKey: "leaderboard",
    cronPath: null,
    fallbackSchedule: "manual",
    manual: {
      kind: "project",
      label: "Project ID required",
      detail: "Use Re-compute leaderboard on /admin/projects/[id].",
    },
    description:
      "Re-scores one project. No root cron is configured in vercel.json.",
  },
  {
    name: "takeSnapshot",
    heartbeatKey: "snapshot",
    cronPath: "/api/cron/snapshot",
    fallbackSchedule: "0 0 * * *",
    manual: {
      kind: "enabled",
      label: "No args",
      detail: "Queues the root snapshot fan-out for all eligible projects.",
    },
    description:
      "Daily snapshot freeze. Per-project trigger lives on project pages.",
  },
  {
    name: "executePayout",
    heartbeatKey: "payouts",
    cronPath: "/api/cron/payout",
    fallbackSchedule: "30 0 * * *",
    manual: {
      kind: "enabled",
      label: "No args",
      detail: "Queues payout fan-out for frozen snapshots awaiting payout.",
    },
    description: "Claim + distribute all frozen snapshots awaiting payout.",
  },
  {
    name: "expireEscrow",
    heartbeatKey: "escrow",
    cronPath: "/api/cron/expire-escrow",
    fallbackSchedule: "0 1 * * *",
    manual: {
      kind: "enabled",
      label: "No args",
      detail: "Queues the escrow expiry sweep.",
    },
    description: "Sweep expired escrow back to platform.",
  },
  {
    name: "publishKpis",
    heartbeatKey: null,
    cronPath: "/api/cron/publish-kpis",
    fallbackSchedule: "* * * * *",
    manual: {
      kind: "enabled",
      label: "No args",
      detail: "Queues public ticker cache publication.",
    },
    description: "Publish the cached public landing ticker.",
  },
  {
    name: "processClaim",
    heartbeatKey: null,
    cronPath: null,
    fallbackSchedule: "event only",
    manual: {
      kind: "event",
      label: "Event payload required",
      detail:
        "Triggered by claim routes with contributorId, userId, and walletAddress.",
    },
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
          Cron reality, heartbeat freshness, and safe manual queueing. A manual
          trigger queues a run; it does not prove the workflow completed.
        </p>
      </header>

      <Card depth="flat" padding="none" className="overflow-hidden">
        <CardHeader className="px-4 pt-4">
          <CardTitle className="flex items-center gap-2">
            <Workflow className="size-4 text-fg-muted" /> Known workflows
          </CardTitle>
          <CardDescription>
            Cron schedules are read from vercel.json. Heartbeat freshness: green
            &lt; 2m, yellow &lt; 10m, red older / never.
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-body-sm">
            <thead className="bg-surface-elevated/50 text-label-sm text-fg-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Workflow</th>
                <th className="px-4 py-2 font-medium">Schedule</th>
                <th className="px-4 py-2 font-medium">Last beat</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Manual args</th>
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
                      <div>{scheduleFor(w)}</div>
                      <div className="text-caption text-fg-muted">
                        {w.cronPath ? w.cronPath : "not in vercel.json"}
                      </div>
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
                      <ManualRequirement manual={w.manual} />
                    </td>
                    <td className="px-4 py-2">
                      <WorkflowRetriggerButton
                        name={w.name}
                        disabled={w.manual.kind !== "enabled"}
                        disabledReason={w.manual.detail}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function scheduleFor(workflow: WorkflowDef): string {
  if (!workflow.cronPath) return workflow.fallbackSchedule;
  return CRON_BY_PATH.get(workflow.cronPath) ?? workflow.fallbackSchedule;
}

function ManualRequirement({ manual }: { manual: ManualTrigger }) {
  const variant =
    manual.kind === "enabled"
      ? "success"
      : manual.kind === "project"
        ? "warning"
        : "info";

  return (
    <div className="max-w-[18rem] space-y-1">
      <Badge variant={variant} size="sm">
        {manual.label}
      </Badge>
      <p className="text-caption text-fg-muted">{manual.detail}</p>
    </div>
  );
}
