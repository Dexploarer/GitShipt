import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBagsRestEnvelope } from "./rest";

describe("parseBagsRestEnvelope", () => {
  it("unwraps and validates successful Bags responses", () => {
    const parsed = parseBagsRestEnvelope(
      {
        success: true,
        response: { wallet: "GitBags1111111111111111111111111111111111111" },
      },
      z.object({ wallet: z.string().min(32) }),
    );

    expect(parsed.wallet).toBe(
      "GitBags1111111111111111111111111111111111111",
    );
  });

  it("rejects failed Bags responses before callers touch the payload", () => {
    expect(() =>
      parseBagsRestEnvelope(
        { success: false, error: "rate limited" },
        z.object({ wallet: z.string() }),
      ),
    ).toThrow("Bags API error: rate limited");
  });

  it("rejects drifted successful payload shapes", () => {
    expect(() =>
      parseBagsRestEnvelope(
        { success: true, response: { wallet: null } },
        z.object({ wallet: z.string().min(32) }),
      ),
    ).toThrow();
  });
});
