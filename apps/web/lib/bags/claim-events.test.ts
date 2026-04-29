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
const STUB_PLACEHOLDER_MINT = "GShiptDemoMint111111111111111111111111111111";

describe("bags.getClaimEventsByTime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty events without fetch when credentials are missing", async () => {
    installEnvMocks({ BAGS_API_KEY: undefined });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getClaimEventsByTime(REAL_MINT, 1, 2);

    expect(result).toEqual({ events: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty events for the placeholder demo mint without fetch", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getClaimEventsByTime(
      STUB_PLACEHOLDER_MINT,
      1700000000,
      1700003600,
    );

    expect(result).toEqual({ events: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the time-windowed claim events endpoint and coerces amount to bigint", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          response: {
            events: [
              {
                wallet: "GitShiptWallet1111111111111111111111111111111",
                isCreator: false,
                amount: "1500000000",
                signature: "sig1",
                timestamp: "2024-01-01T00:00:00Z",
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.getClaimEventsByTime(
      REAL_MINT,
      1700000000,
      1700003600,
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.amount).toBe(1500000000n);
    expect(typeof result.events[0]!.amount).toBe("bigint");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]![0]);
    expect(calledUrl).toContain("fee-share/token/claim-events");
    expect(calledUrl).toContain(`tokenMint=${REAL_MINT}`);
    expect(calledUrl).toContain("mode=time");
    expect(calledUrl).toContain("from=1700000000");
    expect(calledUrl).toContain("to=1700003600");
  });

  it("rejects when toUnix is less than fromUnix", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });
    vi.stubGlobal("fetch", vi.fn());

    const { bags } = await import("./client");

    await expect(
      bags.getClaimEventsByTime(REAL_MINT, 1700003600, 1700000000),
    ).rejects.toThrow("toUnix must be >= fromUnix");
  });

  it("rejects non-integer fromUnix or toUnix", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });
    vi.stubGlobal("fetch", vi.fn());

    const { bags } = await import("./client");

    await expect(
      bags.getClaimEventsByTime(REAL_MINT, 1.5, 2),
    ).rejects.toThrow("fromUnix and toUnix must be integer");
  });
});
