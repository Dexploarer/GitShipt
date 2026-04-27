import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasCredentials } from "@/lib/env";
import { check } from "@/lib/rate-limit";
import { getProjectRecord } from "@/lib/queries/dashboard";
import { tradingHalt } from "@/lib/trading-controls";
import { recordTradingMetric } from "@/lib/trading-metrics";
import {
  ProjectTradeQuoteRequestSchema,
  getProjectTradeQuote,
  tradingCredentialsReady,
} from "@/app/api/bags/_lib/trading";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function rateLimitHeaders(limit: Awaited<ReturnType<typeof check>>): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(limit.limit));
  headers.set("X-RateLimit-Remaining", String(limit.remaining));
  if (limit.reset > 0) {
    headers.set("X-RateLimit-Reset", String(Math.ceil(limit.reset / 1000)));
    headers.set(
      "Retry-After",
      String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))),
    );
  }
  return headers;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const { id: projectId } = await ctx.params;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await check("trade-quote", `${projectId}:${ip}`);
  const headers = rateLimitHeaders(limit);
  if (!limit.success) {
    await recordTradingMetric({
      route: "quote",
      projectId,
      status: "rate_limited",
    });
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers },
    );
  }

  const ready = tradingCredentialsReady();
  if (!ready.ok) {
    await recordTradingMetric({
      route: "quote",
      projectId,
      status: "blocked",
      reason: ready.code,
    });
    return NextResponse.json(
      { error: ready.code, message: ready.message },
      { status: 503 },
    );
  }

  const project = await getProjectRecord(projectId);
  if (!project) {
    await recordTradingMetric({
      route: "quote",
      projectId,
      status: "invalid",
      reason: "not_found",
    });
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!project.tokenMint || project.status !== "live") {
    await recordTradingMetric({
      route: "quote",
      projectId,
      status: "blocked",
      reason: `project_status:${project.status}`,
    });
    return NextResponse.json(
      {
        error: "token_not_tradeable",
        message: "Only live Bags tokens can be quoted.",
      },
      { status: 409 },
    );
  }

  const halt = await tradingHalt(projectId);
  if (halt.halted) {
    await recordTradingMetric({
      route: "quote",
      projectId,
      status: "blocked",
      reason: `kill_switch:${halt.scope}`,
    });
    return NextResponse.json(
      {
        error: "trading_disabled",
        message: "Trading builders are paused by a platform kill switch.",
        scope: halt.scope,
      },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    await recordTradingMetric({
      route: "quote",
      projectId,
      status: "invalid",
      reason: "invalid_json",
    });
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const body = ProjectTradeQuoteRequestSchema.parse(raw);
    const payload = await getProjectTradeQuote({
      tokenMint: project.tokenMint,
      side: body.side,
      amount: body.amount,
      slippageBps: body.slippageBps,
    });
    await recordTradingMetric({ route: "quote", projectId, status: "success" });
    return NextResponse.json(payload, { headers });
  } catch (e) {
    if (e instanceof ZodError) {
      await recordTradingMetric({
        route: "quote",
        projectId,
        status: "invalid",
        reason: "invalid_request",
      });
      return NextResponse.json(
        { error: "invalid_request", issues: e.issues },
        { status: 400 },
      );
    }
    const message = e instanceof Error ? e.message : "Quote failed.";
    console.error("[projects:trading:quote] failed:", e);
    await recordTradingMetric({
      route: "quote",
      projectId,
      status: "failed",
      reason: "quote_failed",
    });
    return NextResponse.json(
      { error: "quote_failed", message },
      { status: 502 },
    );
  }
}
