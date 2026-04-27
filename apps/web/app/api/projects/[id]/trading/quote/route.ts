import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasCredentials } from "@/lib/env";
import { check } from "@/lib/rate-limit";
import { getProjectRecord } from "@/lib/queries/dashboard";
import {
  ProjectTradeQuoteRequestSchema,
  getProjectTradeQuote,
  tradingCredentialsReady,
} from "@/app/api/bags/_lib/trading";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const ready = tradingCredentialsReady();
  if (!ready.ok) {
    return NextResponse.json(
      { error: ready.code, message: ready.message },
      { status: 503 },
    );
  }

  const { id: projectId } = await ctx.params;
  const project = await getProjectRecord(projectId);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!project.tokenMint || project.status !== "live") {
    return NextResponse.json(
      {
        error: "token_not_tradeable",
        message: "Only live Bags tokens can be quoted.",
      },
      { status: 409 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await check("default", `trade-quote:${projectId}:${ip}`);
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const body = ProjectTradeQuoteRequestSchema.parse(await req.json());
    const payload = await getProjectTradeQuote({
      tokenMint: project.tokenMint,
      side: body.side,
      amount: body.amount,
      slippageBps: body.slippageBps,
    });
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_request", issues: e.issues },
        { status: 400 },
      );
    }
    const message = e instanceof Error ? e.message : "Quote failed.";
    console.error("[projects:trading:quote] failed:", e);
    return NextResponse.json(
      { error: "quote_failed", message },
      { status: 502 },
    );
  }
}
