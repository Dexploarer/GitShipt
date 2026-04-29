import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => {
  const fakeEnv: {
    EMERGENCY_KILL_SWITCH: boolean;
    KILL_SWITCH_ENABLED: boolean;
    NODE_ENV: "development" | "test" | "production";
  } = {
    EMERGENCY_KILL_SWITCH: false,
    KILL_SWITCH_ENABLED: false,
    NODE_ENV: "test",
  };
  return {
    serverEnv: () => fakeEnv,
    __setEnv: (next: Partial<typeof fakeEnv>) => Object.assign(fakeEnv, next),
  };
});

const mockedRows: { value: unknown }[][] = [[], []];

vi.mock("@/db", () => {
  const select = () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(mockedRows.shift() ?? []),
      }),
    }),
  });
  return { dbHttp: { select } };
});

vi.mock("@/db/schema", () => ({ platformConfig: { key: {}, value: {} } }));

import * as envMock from "@/lib/env";
import { tradingHalt } from "./trading-controls";

const setEnv = (envMock as unknown as {
  __setEnv: (next: {
    EMERGENCY_KILL_SWITCH?: boolean;
    KILL_SWITCH_ENABLED?: boolean;
    NODE_ENV?: "development" | "test" | "production";
  }) => void;
}).__setEnv;

const queueRows = (global: unknown, project: unknown) => {
  mockedRows.length = 0;
  mockedRows.push(global === undefined ? [] : [{ value: global }]);
  mockedRows.push(project === undefined ? [] : [{ value: project }]);
};

describe("tradingHalt", () => {
  beforeEach(() => {
    setEnv({
      EMERGENCY_KILL_SWITCH: false,
      KILL_SWITCH_ENABLED: false,
      NODE_ENV: "test",
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns halted when EMERGENCY_KILL_SWITCH is true (no DB read needed)", async () => {
    setEnv({ EMERGENCY_KILL_SWITCH: true });
    queueRows(undefined, undefined);
    await expect(tradingHalt("p1")).resolves.toEqual({
      halted: true,
      scope: "env",
      reason: "EMERGENCY_KILL_SWITCH=true",
    });
  });

  it("returns halted when KILL_SWITCH_ENABLED is true", async () => {
    setEnv({ KILL_SWITCH_ENABLED: true });
    queueRows(undefined, undefined);
    await expect(tradingHalt("p1")).resolves.toEqual({
      halted: true,
      scope: "env",
      reason: "KILL_SWITCH_ENABLED=true",
    });
  });

  it("rejects coerced truthy values like 'yes' (in test env, throws)", async () => {
    queueRows({ enabled: "yes" }, undefined);
    await expect(tradingHalt("p1")).rejects.toThrow(/Zod/);
  });

  it("rejects coerced truthy values like 1", async () => {
    queueRows({ enabled: 1 }, undefined);
    await expect(tradingHalt("p1")).rejects.toThrow(/Zod/);
  });

  it("returns halted when malformed payload is seen in production", async () => {
    setEnv({ NODE_ENV: "production" });
    queueRows({ enabled: "yes" }, undefined);
    const result = await tradingHalt("p1");
    expect(result).toMatchObject({ halted: true, scope: "global" });
  });

  it("returns halted on a valid global enabled=true", async () => {
    queueRows({ enabled: true, reason: "scheduled maintenance" }, undefined);
    await expect(tradingHalt("p1")).resolves.toEqual({
      halted: true,
      scope: "global",
      reason: "scheduled maintenance",
    });
  });

  it("returns halted on a valid project entry", async () => {
    queueRows(undefined, { p1: { enabled: true, reason: "abuse review" } });
    await expect(tradingHalt("p1")).resolves.toEqual({
      halted: true,
      scope: "project",
      reason: "abuse review",
    });
  });

  it("returns not halted when global is enabled=false and no project entry", async () => {
    queueRows({ enabled: false }, { other: { enabled: true } });
    await expect(tradingHalt("p1")).resolves.toEqual({ halted: false });
  });

  it("returns not halted when no rows are present", async () => {
    queueRows(undefined, undefined);
    await expect(tradingHalt("p1")).resolves.toEqual({ halted: false });
  });
});
