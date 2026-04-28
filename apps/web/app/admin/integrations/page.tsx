import {
  Database,
  Github,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { Card, CardHeader, CardTitle, CardDescription } from "@repo/ui";
import { Badge } from "@repo/ui";
import { hasCredentials, productionReadiness, serverEnv } from "@/lib/env";
import { dbHttp } from "@/db";
import { sql } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { bags } from "@/lib/bags/client";
import { getCachedValue } from "@/lib/cache";
import { hasSolanaConnection, solanaConnection } from "@/lib/solana/connection";
import { cn } from "@repo/lib";

export const dynamic = "force-dynamic";

interface ServiceHealth {
  name: string;
  status: "ok" | "stub" | "fail";
  latencyMs: number | null;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default async function AdminIntegrationsPage() {
  await requireAdminPage("admin.access", "/admin");

  const services = await Promise.all([
    pingDb(),
    pingRedis(),
    pingBags(),
    pingGithubApp(),
    pingHelius(),
    pingProductionReadiness(),
    pingSentry(),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md">Integrations</h1>
        <p className="text-body-sm text-fg-secondary">
          Read-only health checks. Refresh the page to re-ping.
        </p>
      </header>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <ServiceCard key={s.name} service={s} />
        ))}
      </section>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const Icon = service.icon;
  return (
    <Card depth="raised" padding="default">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-fg-muted" /> {service.name}
        </CardTitle>
        <CardDescription>{service.detail}</CardDescription>
      </CardHeader>
      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "size-2 rounded-full",
              service.status === "ok"
                ? "bg-success"
                : service.status === "stub"
                  ? "bg-warning"
                  : "bg-danger",
            )}
            aria-hidden
          />
          <Badge
            variant={
              service.status === "ok"
                ? "success"
                : service.status === "stub"
                  ? "warning"
                  : "danger"
            }
            size="sm"
          >
            {service.status}
          </Badge>
        </span>
        <span className="text-mono-sm text-fg-muted">
          {service.latencyMs == null ? "—" : `${service.latencyMs} ms`}
        </span>
      </div>
    </Card>
  );
}

function shortWallet(value: string): string {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function pingDb(): Promise<ServiceHealth> {
  const t = Date.now();
  try {
    await dbHttp.execute(sql`SELECT 1`);
    return {
      name: "Neon Postgres",
      status: "ok",
      latencyMs: Date.now() - t,
      detail: "SELECT 1 succeeded.",
      icon: Database,
    };
  } catch (e) {
    return {
      name: "Neon Postgres",
      status: "fail",
      latencyMs: null,
      detail: (e as Error).message,
      icon: Database,
    };
  }
}

async function pingRedis(): Promise<ServiceHealth> {
  const r = redis();
  if (!r)
    return {
      name: "Redis",
      status: "stub",
      latencyMs: null,
      detail: "REDIS_URL not configured.",
      icon: PlugZap,
    };
  const t = Date.now();
  try {
    await r.ping();
    return {
      name: "Redis",
      status: "ok",
      latencyMs: Date.now() - t,
      detail: "PING ok.",
      icon: PlugZap,
    };
  } catch (e) {
    return {
      name: "Redis",
      status: "fail",
      latencyMs: null,
      detail: (e as Error).message,
      icon: PlugZap,
    };
  }
}

async function pingBags(): Promise<ServiceHealth> {
  const env = serverEnv();
  const partnerDetail = `Partner ${shortWallet(env.BAGS_PARTNER_WALLET)}; ref=${env.BAGS_REF_CODE}.`;
  if (!bags.hasCredentials()) {
    return {
      name: "Bags.fm",
      status: "stub",
      latencyMs: null,
      detail: `BAGS_API_KEY missing — typed client returning stubs. ${partnerDetail}`,
      icon: Sparkles,
    };
  }
  // GET /auth/me validates the API key directly against the Bags REST API.
  // No Solana RPC, unlike the legacy getLifetimeFees(SOL_MINT) probe which
  // derived an on-chain PDA and burned Helius credits per /admin/integrations
  // render. Cached 60s; throw on probe failure carries the error message.
  const probe = await getCachedValue<
    | { ok: true; latencyMs: number }
    | { ok: false; latencyMs: null; error: string }
  >(
    async () => {
      const start = Date.now();
      try {
        await bags.authMe();
        return { ok: true, latencyMs: Date.now() - start };
      } catch (e) {
        return { ok: false, latencyMs: null, error: (e as Error).message };
      }
    },
    ["gitbags:admin:integrations:ping-bags:v2"],
    { tags: ["gitbags:admin:integrations:health"], revalidate: 60 },
  );
  if (probe.ok) {
    return {
      name: "Bags.fm",
      status: "ok",
      latencyMs: probe.latencyMs,
      detail: `Auth probe ok. ${partnerDetail}`,
      icon: Sparkles,
    };
  }
  return {
    name: "Bags.fm",
    status: "fail",
    latencyMs: null,
    detail: probe.error,
    icon: Sparkles,
  };
}

async function pingGithubApp(): Promise<ServiceHealth> {
  if (!hasCredentials.githubApp()) {
    return {
      name: "GitHub App",
      status: "stub",
      latencyMs: null,
      detail: "App credentials not configured.",
      icon: Github,
    };
  }
  const t = Date.now();
  try {
    const { appOctokit } = await import("@/lib/github/app");
    const oc = appOctokit();
    const res = await oc.request("GET /app/installations");
    const installations = Array.isArray(res.data) ? res.data.length : 0;
    return {
      name: "GitHub App",
      status: "ok",
      latencyMs: Date.now() - t,
      detail: `${installations} installation${installations === 1 ? "" : "s"} reachable.`,
      icon: Github,
    };
  } catch (e) {
    return {
      name: "GitHub App",
      status: "fail",
      latencyMs: null,
      detail: (e as Error).message,
      icon: Github,
    };
  }
}

async function pingHelius(): Promise<ServiceHealth> {
  if (!hasCredentials.solana()) {
    return {
      name: "Helius RPC",
      status: "stub",
      latencyMs: null,
      detail: "HELIUS_RPC_URL missing — using devnet fallback.",
      icon: Zap,
    };
  }
  const t = Date.now();
  try {
    if (!hasSolanaConnection()) throw new Error("connection unavailable");
    const slot = await solanaConnection().getSlot();
    return {
      name: "Helius RPC",
      status: "ok",
      latencyMs: Date.now() - t,
      detail: `Slot ${slot}.`,
      icon: Zap,
    };
  } catch (e) {
    return {
      name: "Helius RPC",
      status: "fail",
      latencyMs: null,
      detail: (e as Error).message,
      icon: Zap,
    };
  }
}

async function pingProductionReadiness(): Promise<ServiceHealth> {
  const readiness = productionReadiness();
  const problemCount = readiness.missing.length + readiness.warnings.length;
  return {
    name: "Production readiness",
    status: readiness.ok ? "ok" : "fail",
    latencyMs: null,
    detail: readiness.ok
      ? readiness.mode === "production"
        ? `Mainnet env ready for ${readiness.bagsApiBaseUrl}.`
        : `Non-production mode on ${readiness.cluster}; production gate is idle.`
      : `${problemCount} configuration issue${problemCount === 1 ? "" : "s"}: ${[
          ...readiness.missing,
          ...readiness.warnings,
        ]
          .slice(0, 3)
          .join(", ")}${problemCount > 3 ? ", ..." : ""}`,
    icon: ShieldCheck,
  };
}

async function pingSentry(): Promise<ServiceHealth> {
  // We don't bundle Sentry yet; this card just reports the env presence so
  // the operator knows whether errors are being captured.
  return {
    name: "Sentry",
    status: "stub",
    latencyMs: null,
    detail: "Error reporting is tracked by env readiness for this deployment.",
    icon: PlugZap,
  };
}
