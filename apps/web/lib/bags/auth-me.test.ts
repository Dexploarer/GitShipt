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
  // signer never gets called by authMe but client.ts imports it at top
  vi.doMock("@/lib/solana/signer", () => ({
    payoutSigner: () => {
      throw new Error("payoutSigner should not be called in this test");
    },
  }));
}

describe("bags.authMe", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when BAGS_API_KEY is missing", async () => {
    installEnvMocks({ BAGS_API_KEY: undefined });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");

    await expect(bags.authMe()).rejects.toThrow(
      "BAGS_API_KEY required for authMe.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls /auth/me with the x-api-key header and returns the parsed user", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          response: { user: { uuid: "u-1", username: "alice" } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");
    const result = await bags.authMe();

    expect(result.user.uuid).toBe("u-1");
    expect(result.user.username).toBe("alice");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0]!;
    expect(String(calledUrl)).toContain("/auth/me");
    expect((calledInit as RequestInit).headers).toMatchObject({
      "x-api-key": "test-key",
    });
  });

  it("throws when the upstream returns 401", async () => {
    installEnvMocks({ BAGS_API_KEY: "test-key" });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bags } = await import("./client");

    await expect(bags.authMe()).rejects.toThrow(/Bags 401/);
  });
});
