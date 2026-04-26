import { describe, expect, it } from "vitest";
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
