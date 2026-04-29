import "server-only";
import { redis } from "@/lib/redis";

type TradingMetricRoute = "quote" | "swap";
type TradingMetricStatus =
  | "blocked"
  | "failed"
  | "invalid"
  | "rate_limited"
  | "success";

export interface TradingMetric {
  route: TradingMetricRoute;
  projectId: string;
  status: TradingMetricStatus;
  reason?: string;
}

function metricPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9:_-]/g, "_").slice(0, 96);
}

export async function recordTradingMetric(metric: TradingMetric): Promise<void> {
  console.info("[projects:trading]", metric);

  try {
    const r = redis();
    if (!r) return;

    const minute = Math.floor(Date.now() / 60_000);
    const base = `gitshipt:metrics:trading:${metric.route}:${metric.projectId}:${minute}`;
    const statusKey = `${base}:${metric.status}`;
    const routeKey = `gitshipt:metrics:trading:${metric.route}:all:${minute}`;
    const reasonKey = metric.reason
      ? `${base}:${metric.status}:${metricPart(metric.reason)}`
      : null;

    const pipe = r.pipeline();
    pipe.incr(statusKey);
    pipe.expire(statusKey, 60 * 60 * 24);
    if (reasonKey) {
      pipe.incr(reasonKey);
      pipe.expire(reasonKey, 60 * 60 * 24);
    }
    pipe.incr(routeKey);
    pipe.expire(routeKey, 60 * 60 * 24);
    await pipe.exec();
  } catch (error) {
    console.warn("[projects:trading:metrics] failed:", error);
  }
}
