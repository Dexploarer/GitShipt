import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { formatSol } from "@repo/lib";
import type { MyProjectRow } from "@/lib/queries/dashboard";

export function ProjectList({ rows }: { rows: MyProjectRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((p) => (
        <li
          key={p.id}
          className="grid grid-cols-[40px_minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-6 py-3 transition-colors hover:bg-surface-elevated/40"
        >
          <Avatar src={p.imageUrl} alt={p.slug} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-label-md text-fg">{p.name}</span>
              <StatusBadge status={p.status} />
            </div>
            <div className="text-mono-sm text-fg-muted truncate">{p.slug}</div>
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-mono-sm text-fg-secondary">
              {p.contributorsCount}
            </div>
            <div className="text-caption text-fg-muted">contributors</div>
          </div>
          <div className="hidden text-right md:block">
            <div className="text-mono-sm text-primary">
              {formatSol(p.lifetimeFeesLamports, 4)}
            </div>
            <div className="text-caption text-fg-muted">lifetime</div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/dashboard/projects/${p.id}`}>
              Open <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Avatar({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <span className="grid size-10 place-items-center rounded-full bg-surface-elevated text-label-sm text-fg-muted">
        {alt.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="size-10 rounded-full border border-border object-cover"
    />
  );
}

export function StatusBadge({
  status,
}: {
  status: "draft" | "launch_configured" | "live" | "paused" | "killed" | "simulated_live";
}) {
  const map = {
    live: { variant: "success" as const, label: "Live", dot: true },
    launch_configured: {
      variant: "warning" as const,
      label: "Configured",
      dot: false,
    },
    draft: { variant: "default" as const, label: "Draft", dot: false },
    paused: { variant: "warning" as const, label: "Paused", dot: false },
    killed: { variant: "danger" as const, label: "Killed", dot: false },
    simulated_live: {
      variant: "default" as const,
      label: "Simulated",
      dot: false,
    },
  } as const;
  const v = map[status];
  return (
    <Badge variant={v.variant} size="sm" dot={v.dot}>
      {v.label}
    </Badge>
  );
}
