import { beforeEach, describe, expect, it, vi } from "vitest";
import { languageColor } from "@repo/lib";
import { deriveKey } from "./idempotency";

describe("deriveKey", () => {
  it("creates stable colon-delimited idempotency keys", () => {
    expect(deriveKey("snapshot", 42, "contributor")).toBe(
      "snapshot:42:contributor",
    );
  });
});

describe("languageColor", () => {
  it("uses theme tokens instead of raw color values", () => {
    expect(languageColor("TypeScript")).toBe("var(--chart-4)");
    expect(languageColor("Unknown")).toBe("var(--fg-muted)");
  });
});

describe("withIdempotency", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("claims the key before running side effects", async () => {
    const store = new Map<string, string>();
    const fakeRedis = {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(
        async (
          key: string,
          value: string,
          _ex: "EX",
          _ttl: number,
          nx?: "NX",
        ) => {
          if (nx === "NX" && store.has(key)) return null;
          store.set(key, value);
          return "OK";
        },
      ),
      del: vi.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
    };
    vi.doMock("@/lib/redis", () => ({ redis: () => fakeRedis }));
    vi.doMock("@/lib/env", () => ({
      serverEnv: () => ({ NODE_ENV: "test" }),
    }));

    const { withIdempotency, IdempotencyReplayError } = await import(
      "./idempotency"
    );

    let release!: () => void;
    const running = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sideEffect = vi.fn(async () => {
      await running;
      return { ok: true };
    });

    const first = withIdempotency("same-key", sideEffect, { scope: "test" });
    await expect(
      withIdempotency("same-key", sideEffect, { scope: "test" }),
    ).rejects.toBeInstanceOf(IdempotencyReplayError);
    expect(sideEffect).toHaveBeenCalledTimes(1);

    release();
    await expect(first).resolves.toEqual({ ok: true });
  });
});
