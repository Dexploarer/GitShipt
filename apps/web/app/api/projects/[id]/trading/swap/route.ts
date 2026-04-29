import "server-only";
import { ZodError } from "zod";
import { hasCredentials } from "@/lib/env";
import { check } from "@/lib/rate-limit";
import { getProjectRecord } from "@/lib/queries/dashboard";
import { tradingHalt } from "@/lib/trading-controls";
import { recordTradingMetric } from "@/lib/trading-metrics";
import {
  privateNoStoreHeaders,
  privateNoStoreJson,
} from "@/lib/no-store-response";
import {
  ProjectTradeSwapRequestSchema,
  WRAPPED_SOL_MINT,
  createProjectSwapTransaction,
  tradingCredentialsReady,
} from "@/app/api/bags/_lib/trading";


interface RouteContext {
  params: Promise<{ id: string }>;
}

function rateLimitHeaders(limit: Awaited<ReturnType<typeof check>>): Headers {
  const headers = privateNoStoreHeaders();
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
    return privateNoStoreJson(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const { id: projectId } = await ctx.params;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await check("trade-swap", `${projectId}:${ip}`);
  const headers = rateLimitHeaders(limit);
  if (!limit.success) {
    await recordTradingMetric({
      route: "swap",
      projectId,
      status: "rate_limited",
    });
    return privateNoStoreJson(
      { error: "rate_limited" },
      { status: 429, headers },
    );
  }

  const ready = tradingCredentialsReady();
  if (!ready.ok) {
    await recordTradingMetric({
      route: "swap",
      projectId,
      status: "blocked",
      reason: ready.code,
    });
    return privateNoStoreJson(
      { error: ready.code, message: ready.message },
      { status: 503 },
    );
  }

  const project = await getProjectRecord(projectId);
  if (!project) {
    await recordTradingMetric({
      route: "swap",
      projectId,
      status: "invalid",
      reason: "not_found",
    });
    return privateNoStoreJson({ error: "not_found" }, { status: 404 });
  }
  if (!project.tokenMint || project.status !== "live") {
    await recordTradingMetric({
      route: "swap",
      projectId,
      status: "blocked",
      reason: `project_status:${project.status}`,
    });
    return privateNoStoreJson(
      {
        error: "token_not_tradeable",
        message: "Only live Bags tokens can be swapped.",
      },
      { status: 409 },
    );
  }

  const halt = await tradingHalt(projectId);
  if (halt.halted) {
    await recordTradingMetric({
      route: "swap",
      projectId,
      status: "blocked",
      reason: `kill_switch:${halt.scope}`,
    });
    return privateNoStoreJson(
      {
        error: "trading_disabled",
        message: "Swap builders are paused by a platform kill switch.",
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
      route: "swap",
      projectId,
      status: "invalid",
      reason: "invalid_json",
    });
    return privateNoStoreJson({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const body = ProjectTradeSwapRequestSchema.parse(raw);
    const quote = body.quoteResponse;
    const isProjectBuy =
      quote.inputMint === WRAPPED_SOL_MINT &&
      quote.outputMint === project.tokenMint;
    const isProjectSell =
      quote.inputMint === project.tokenMint &&
      quote.outputMint === WRAPPED_SOL_MINT;
    if (!isProjectBuy && !isProjectSell) {
      await recordTradingMetric({
        route: "swap",
        projectId,
        status: "invalid",
        reason: "quote_mismatch",
      });
      return privateNoStoreJson(
        {
          error: "quote_mismatch",
          message: "Quote does not match this project's token.",
        },
        { status: 400 },
      );
    }

    const payload = await createProjectSwapTransaction(body);
    await recordTradingMetric({ route: "swap", projectId, status: "success" });
    return privateNoStoreJson(payload, { headers });
  } catch (e) {
    if (e instanceof ZodError) {
      await recordTradingMetric({
        route: "swap",
        projectId,
        status: "invalid",
        reason: "invalid_request",
      });
      return privateNoStoreJson(
        { error: "invalid_request", issues: e.issues },
        { status: 400 },
      );
    }
    const message = e instanceof Error ? e.message : "Swap transaction failed.";
    console.error("[projects:trading:swap] failed:", e);
    await recordTradingMetric({
      route: "swap",
      projectId,
      status: "failed",
      reason: "swap_transaction_failed",
    });
    return privateNoStoreJson(
      { error: "swap_transaction_failed", message },
      { status: 502 },
    );
  }
}
