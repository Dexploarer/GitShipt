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

const REAL_MINT = "So11111111111111111111111111111111111111112";
const STUB_PLACEHOLDER_MINT = "GBAGSdemoTokenMint11111111111111111111111111";

describe("bags.getPoolByTokenMint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns deterministic stub with null dammV2PoolKey when credentials are missing", async () => {
    installEnvMocks({ BAGS_API_KEY: undefined });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getPoolByTokenMint(REAL_MINT);

    expect(result.tokenMint).toBe(REAL_MINT);
    expect(result.dammV2PoolKey).toBeNull();
    expect(typeof result.dbcConfigKey).toBe("string");
    expect(typeof result.dbcPoolKey).toBe("string");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the stub when given the placeholder demo mint even with credentials", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getPoolByTokenMint(STUB_PLACEHOLDER_MINT);

    expect(result.tokenMint).toBe(STUB_PLACEHOLDER_MINT);
    expect(result.dammV2PoolKey).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the pool-by-mint endpoint and parses null dammV2PoolKey", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          response: {
            tokenMint: REAL_MINT,
            dbcConfigKey: "Cfg" + "1".repeat(40),
            dbcPoolKey: "Pool" + "2".repeat(40),
            dammV2PoolKey: null,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getPoolByTokenMint(REAL_MINT);

    expect(result.dammV2PoolKey).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]![0]);
    expect(calledUrl).toContain("solana/bags/pools/token-mint");
    expect(calledUrl).toContain(`tokenMint=${REAL_MINT}`);
  });

  it("parses a base58 dammV2PoolKey when present", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });

    const dammKey = "Damm" + "3".repeat(40);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          response: {
            tokenMint: REAL_MINT,
            dbcConfigKey: "Cfg" + "1".repeat(40),
            dbcPoolKey: "Pool" + "2".repeat(40),
            dammV2PoolKey: dammKey,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getPoolByTokenMint(REAL_MINT);

    expect(result.dammV2PoolKey).toBe(dammKey);
  });
});
