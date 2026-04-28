import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseBagsRestEnvelope } from "./rest";

describe("parseBagsRestEnvelope", () => {
  it("unwraps and validates successful Bags responses", () => {
    const parsed = parseBagsRestEnvelope(
      {
        success: true,
        response: { wallet: "GitBags1111111111111111111111111111111111111" },
      },
      z.object({ wallet: z.string().min(32) }),
    );

    expect(parsed.wallet).toBe(
      "GitBags1111111111111111111111111111111111111",
    );
  });

  it("rejects failed Bags responses before callers touch the payload", () => {
    expect(() =>
      parseBagsRestEnvelope(
        { success: false, error: "rate limited" },
        z.object({ wallet: z.string() }),
      ),
    ).toThrow("Bags API error: rate limited");
  });

  it("rejects drifted successful payload shapes", () => {
    expect(() =>
      parseBagsRestEnvelope(
        { success: true, response: { wallet: null } },
        z.object({ wallet: z.string().min(32) }),
      ),
    ).toThrow();
  });
});

/**
 * The 429-aware retry lives in `bagsRestRaw` inside `client.ts` (not exported
 * from this module). We exercise it via `bags.authMe`, which is the simplest
 * GET path that funnels straight through `bagsRestRaw`.
 */
function installEnvMocks() {
  const env = {
    NODE_ENV: "test",
    BAGS_API_BASE_URL: "https://public-api-v2.bags.fm/api/v1/",
    BAGS_API_KEY: "test-key" as string | undefined,
  };
  vi.doMock("@/lib/env", () => ({
    serverEnv: () => env,
    hasCredentials: { bags: () => Boolean(env.BAGS_API_KEY) },
    canLaunchOnBags: () => ({ ok: true }),
    stubsAllowed: () => true,
  }));
  vi.doMock("@/lib/solana/signer", () => ({
    payoutSigner: () => {
      throw new Error("payoutSigner should not be called in this test");
    },
  }));
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function rateLimitedResponse(opts: {
  resetTime?: number;
  resetHeader?: string | null;
  remaining?: string | null;
}): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.resetHeader != null) headers["X-RateLimit-Reset"] = opts.resetHeader;
  if (opts.remaining != null) headers["X-RateLimit-Remaining"] = opts.remaining;
  const body =
    opts.resetTime !== undefined
      ? JSON.stringify({ success: false, resetTime: opts.resetTime })
      : JSON.stringify({ success: false });
  return new Response(body, { status: 429, statusText: "Too Many Requests", headers });
}

const validAuthMeBody = {
  success: true,
  response: { user: { uuid: "u-1", username: "alice" } },
};

describe("bagsRestRaw 429 retry behaviour", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries once after a 429, waits at least 1s, and returns the second response", async () => {
    installEnvMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T00:00:00Z"));
    const resetTime = Math.floor(Date.now() / 1000) + 2;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimitedResponse({ resetTime }))
      .mockResolvedValueOnce(okResponse(validAuthMeBody));
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const promise = bags.authMe();

    // First fetch dispatched. Drain the await chain so the 429 handler can run
    // and schedule its setTimeout, then advance fake clock past the wait.
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_000);

    const result = await promise;
    expect(result.user.uuid).toBe("u-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws with 'rate limit exhausted' and the reset timestamp when both calls 429", async () => {
    installEnvMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T00:00:00Z"));
    const resetTime = Math.floor(Date.now() / 1000) + 1;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimitedResponse({ resetTime }))
      .mockResolvedValueOnce(rateLimitedResponse({ resetTime }));
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const promise = bags.authMe();
    // Capture the rejection synchronously so an unhandled-rejection warning
    // doesn't race the timer advances below.
    const settled = promise.then(
      (v) => ({ ok: true as const, value: v }),
      (err: unknown) => ({
        ok: false as const,
        message: err instanceof Error ? err.message : String(err),
      }),
    );

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_000);

    const result = await settled;
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.message).toContain("rate limit exhausted");
    const expectedIso = new Date(resetTime * 1000).toISOString();
    expect(result.message).toContain(expectedIso);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("warns when X-RateLimit-Remaining is below the 50-request threshold", async () => {
    installEnvMocks();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const responseWithRemaining = new Response(JSON.stringify(validAuthMeBody), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "X-RateLimit-Remaining": "10",
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(responseWithRemaining);
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    await bags.authMe();

    expect(warnSpy).toHaveBeenCalled();
    const warnMessage = String(warnSpy.mock.calls[0]?.[0] ?? "");
    expect(warnMessage).toContain("rate limit");
    expect(warnMessage).toContain("10");

    warnSpy.mockRestore();
  });
});
