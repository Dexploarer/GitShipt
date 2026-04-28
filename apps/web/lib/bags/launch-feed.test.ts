import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EnvOverrides = Partial<{
  BAGS_API_KEY: string | undefined;
  BAGS_API_BASE_URL: string;
}>;

function installEnvMocks(overrides: EnvOverrides = {}) {
  const env = {
    NODE_ENV: "test",
    BAGS_API_BASE_URL: "https://public-api-v2.bags.fm/api/v1/",
    BAGS_API_KEY: "test-key" as string | undefined,
    ...overrides,
  };
  vi.doMock("@/lib/env", () => ({
    serverEnv: () => env,
    hasCredentials: {
      bags: () => Boolean(env.BAGS_API_KEY),
    },
    canLaunchOnBags: () =>
      env.BAGS_API_KEY ? { ok: true } : { ok: false, reason: "BAGS_API_KEY missing" },
    stubsAllowed: () => true,
  }));
  vi.doMock("@/lib/solana/signer", () => ({
    payoutSigner: () => {
      throw new Error("payoutSigner should not be called in this test");
    },
  }));
}

function feedItem(status: string, mint: string) {
  return {
    name: "Token " + status,
    symbol: status.slice(0, 4),
    description: null,
    image: null,
    tokenMint: mint,
    status,
    twitter: null,
    website: null,
    launchSignature: null,
  };
}

describe("bags.getLaunchFeed", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty array without fetch when credentials are missing", async () => {
    installEnvMocks({ BAGS_API_KEY: undefined });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getLaunchFeed();

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the feed endpoint and parses a valid item", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          response: [
            feedItem("PRE_LAUNCH", "Mint1" + "1".repeat(38)),
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getLaunchFeed();

    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("PRE_LAUNCH");
    const calledUrl = String(fetchMock.mock.calls[0]![0]);
    expect(calledUrl).toContain("token-launch/feed");
  });

  it("parses all four valid status enum values", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });

    const items = [
      feedItem("PRE_LAUNCH", "MintA" + "1".repeat(38)),
      feedItem("PRE_GRAD", "MintB" + "1".repeat(38)),
      feedItem("MIGRATING", "MintC" + "1".repeat(38)),
      feedItem("MIGRATED", "MintD" + "1".repeat(38)),
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, response: items }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getLaunchFeed();

    expect(result.map((i) => i.status)).toEqual([
      "PRE_LAUNCH",
      "PRE_GRAD",
      "MIGRATING",
      "MIGRATED",
    ]);
  });

  it("rejects an item with an unknown status value", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          response: [feedItem("INVALID", "MintX" + "1".repeat(38))],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");

    await expect(bags.getLaunchFeed()).rejects.toThrow();
  });
});
