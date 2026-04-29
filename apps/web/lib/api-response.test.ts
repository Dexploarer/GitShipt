import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability", () => ({
  captureException: vi.fn(),
  captureEvent: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  serverEnv: () => ({ NODE_ENV: "test" }),
}));

import {
  apiError,
  apiInternal,
  apiInvalidBody,
  apiOk,
  apiOkPrivate,
} from "./api-response";

const expectNoStore = (res: Response) => {
  expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
};

describe("api-response helpers", () => {
  it("apiOk returns 200 with no-store and the payload", async () => {
    const res = apiOk({ a: 1 });
    expectNoStore(res);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ a: 1 });
  });

  it("apiOkPrivate marks the response private, no-store", () => {
    const res = apiOkPrivate({ secret: 42 });
    expect(res.headers.get("Cache-Control")).toMatch(/private/);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
  });

  it("apiError serializes the error envelope", async () => {
    const res = apiError(403, "forbidden", "Not allowed");
    expectNoStore(res);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "forbidden",
      message: "Not allowed",
    });
  });

  it("apiInvalidBody flattens Zod issues", async () => {
    const schema = z.object({ name: z.string().min(3) });
    const result = schema.safeParse({ name: "" });
    if (result.success) throw new Error("expected failure");
    const res = apiInvalidBody(result.error);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: unknown };
    expect(body.error).toBe("invalid_body");
    expect(body.details).toBeDefined();
  });

  it("apiInternal returns 500 with a stable code (dev shows error message)", async () => {
    const res = apiInternal(new Error("boom"), { area: "test" });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; message?: string };
    expect(body.error).toBe("internal_error");
    expect(body.message).toBe("boom");
  });
});
