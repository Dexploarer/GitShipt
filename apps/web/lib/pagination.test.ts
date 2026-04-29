import { describe, expect, it } from "vitest";

import {
  buildPage,
  decodeCursor,
  encodeCursor,
  PaginationQuerySchema,
} from "./pagination";

describe("pagination", () => {
  it("encode + decode roundtrip preserves values", () => {
    const ts = new Date("2026-04-28T22:00:00.000Z");
    const c = encodeCursor({ createdAt: ts, id: "abc123" });
    expect(c).toBe("2026-04-28T22:00:00.000Z:abc123");
    const back = decodeCursor(c);
    expect(back?.id).toBe("abc123");
    expect(back?.createdAt.toISOString()).toBe(ts.toISOString());
  });

  it("decodeCursor returns null on garbage", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor(":id")).toBeNull();
    expect(decodeCursor("notadate:id")).toBeNull();
  });

  it("PaginationQuerySchema enforces max limit and cursor format", () => {
    expect(
      PaginationQuerySchema.parse({ limit: "10" }).limit,
    ).toBe(10);
    expect(() =>
      PaginationQuerySchema.parse({ limit: "10000" }),
    ).toThrow();
    expect(() =>
      PaginationQuerySchema.parse({ cursor: "garbage" }),
    ).toThrow();
    expect(
      PaginationQuerySchema.parse({
        cursor: "2026-04-28T22:00:00.000Z:abc123",
      }).cursor,
    ).toBe("2026-04-28T22:00:00.000Z:abc123");
  });

  it("buildPage emits null nextCursor when the page is short", () => {
    const rows = [
      { id: "a", createdAt: new Date("2026-04-28T22:00:00Z") },
      { id: "b", createdAt: new Date("2026-04-28T21:00:00Z") },
    ];
    const page = buildPage(rows, 50);
    expect(page.rows.length).toBe(2);
    expect(page.nextCursor).toBeNull();
  });

  it("buildPage trims to limit and emits nextCursor on overflow", () => {
    const rows = [
      { id: "a", createdAt: new Date("2026-04-28T22:00:00Z") },
      { id: "b", createdAt: new Date("2026-04-28T21:00:00Z") },
      { id: "c", createdAt: new Date("2026-04-28T20:00:00Z") },
    ];
    const page = buildPage(rows, 2);
    expect(page.rows.length).toBe(2);
    expect(page.nextCursor).toBe("2026-04-28T21:00:00.000Z:b");
  });
});
