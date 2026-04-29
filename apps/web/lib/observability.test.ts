import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureEvent,
  captureException,
  registerObservabilityAdapter,
  type ObservabilityAdapter,
} from "./observability";

describe("observability shim", () => {
  afterEach(() => {
    registerObservabilityAdapter(null);
    vi.restoreAllMocks();
  });

  it("writes structured JSON to stderr by default", () => {
    const writes: string[] = [];
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: unknown) => {
        writes.push(typeof chunk === "string" ? chunk : String(chunk));
        return true;
      });

    captureEvent("ping", { area: "test", tags: { k: "v" } });

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(writes.length).toBe(1);
    const line = writes[0]!;
    const parsed = JSON.parse(line.trim());
    expect(parsed.message).toBe("ping");
    expect(parsed.area).toBe("test");
    expect(parsed.tags).toEqual({ k: "v" });
    expect(parsed.severity).toBe("info");
    expect(parsed.type).toBe("event");
  });

  it("forwards captureException to the registered adapter", () => {
    const adapter: ObservabilityAdapter = {
      captureException: vi.fn(),
      captureEvent: vi.fn(),
    };
    registerObservabilityAdapter(adapter);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const err = new Error("boom");
    captureException(err, { area: "tests", tags: { x: "1" } });

    expect(adapter.captureException).toHaveBeenCalledTimes(1);
    expect(adapter.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ area: "tests", tags: { x: "1" } }),
    );
  });

  it("swallows adapter errors so caller is not impacted", () => {
    const adapter: ObservabilityAdapter = {
      captureException: vi.fn(() => {
        throw new Error("vendor SDK exploded");
      }),
      captureEvent: vi.fn(() => {
        throw new Error("vendor SDK exploded");
      }),
    };
    registerObservabilityAdapter(adapter);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    expect(() =>
      captureException(new Error("x"), { area: "a" }),
    ).not.toThrow();
    expect(() => captureEvent("y", { area: "a" })).not.toThrow();
  });

  it("registerObservabilityAdapter(null) reverts to stderr-only", () => {
    const adapter: ObservabilityAdapter = {
      captureException: vi.fn(),
      captureEvent: vi.fn(),
    };
    registerObservabilityAdapter(adapter);
    registerObservabilityAdapter(null);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    captureEvent("after-unregister", { area: "a" });
    expect(adapter.captureEvent).not.toHaveBeenCalled();
  });
});
