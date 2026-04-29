import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redisGet: vi.fn(),
}));

vi.mock("@/db", () => ({ dbHttp: {} }));
vi.mock("@/lib/cache", () => ({
  CACHE_SECONDS: { live: 60, browse: 120 },
  cacheTags: {
    public: "gitshipt:public",
    landing: "gitshipt:landing",
    globalLeaderboard: "gitshipt:global-leaderboard",
    liveTicker: "gitshipt:live-ticker",
  },
  getCachedValue: vi.fn((loader: () => Promise<unknown>) => loader()),
}));
vi.mock("@/lib/redis", () => ({
  redis: () => ({ get: mocks.redisGet }),
}));
// Vitest supports virtual module mocks at runtime; the local types lag here.
// @ts-expect-error virtual mock option is accepted by Vitest.
vi.mock("server-only", () => ({}), { virtual: true });

import {
  getCachedLandingTicker,
  hasRealLandingVolume,
  LANDING_TICKER_CACHE_KEY,
} from "./global";

describe("landing ticker volume", () => {
  beforeEach(() => {
    mocks.redisGet.mockReset();
  });

  it("uses the v2 landing ticker cache key", async () => {
    mocks.redisGet.mockResolvedValue(null);

    await getCachedLandingTicker();

    expect(mocks.redisGet).toHaveBeenCalledWith("gitshipt:ticker:landing:v2");
    expect(LANDING_TICKER_CACHE_KEY).toBe("gitshipt:ticker:landing:v2");
  });

  it("does not surface legacy cached volume without an explicit Bags source", async () => {
    mocks.redisGet.mockResolvedValue(
      JSON.stringify({
        ticker: {
          volume24hUsd: 123_456,
          lifetimeFeesLamports: "5000000000",
          activeProjects: 2,
          contributorsEarning: 9,
        },
        publishedAt: "2026-04-29T00:00:00.000Z",
      }),
    );

    const ticker = await getCachedLandingTicker();

    expect(ticker?.volume24hUsd).toBeNull();
    expect(ticker?.volumeSource).toBe("unavailable");
  });

  it("preserves volume only when it is marked as real Bags data", async () => {
    mocks.redisGet.mockResolvedValue(
      JSON.stringify({
        ticker: {
          volume24hUsd: 789,
          volumeSource: "bags",
          lifetimeFeesLamports: "5000000000",
          activeProjects: 2,
          contributorsEarning: 9,
        },
        publishedAt: "2026-04-29T00:00:00.000Z",
      }),
    );

    const ticker = await getCachedLandingTicker();

    expect(ticker?.volume24hUsd).toBe(789);
    expect(ticker?.volumeSource).toBe("bags");
    expect(hasRealLandingVolume(ticker!)).toBe(true);
  });

  it("treats null, negative, or missing volume as unavailable", () => {
    expect(
      hasRealLandingVolume({
        volume24hUsd: null,
        volumeSource: "unavailable",
      }),
    ).toBe(false);
    expect(
      hasRealLandingVolume({
        volume24hUsd: -1,
        volumeSource: "bags",
      }),
    ).toBe(false);
  });
});
