import { describe, expect, it } from "vitest";
import { CreateProjectBodySchema, TokenMetadataSchema } from "@repo/shared";

const validBody = {
  ghOwner: "sym",
  ghRepo: "gitbags",
  ghRepoId: "42",
  name: "GitBags",
  symbol: "GBAGS",
  description: "Token for sym/gitbags. Fees redistribute to contributors.",
  imageUrl: "https://gitbags.fm/og.png",
  scoringConfig: {
    formulaVersion: "v0",
    windowDays: 30,
    weights: {
      mergedPRs: 3,
      commits: 1,
      reviews: 0,
      issues: 0,
      netLines: 0,
    },
    decay: "linear",
    botBlocklist: [],
    botAllowlist: [],
  },
  payoutConfig: {
    topN: 3,
    tierWeights: [0.5, 0.3, 0.2],
    claimThresholdLamports: 0,
  },
  platformFeeBps: 500,
} as const;

describe("Bags launch schemas", () => {
  it("requires Bags-compatible token descriptions", () => {
    expect(
      TokenMetadataSchema.safeParse({
        name: "GitBags",
        symbol: "GBAGS",
        description: "",
        imageUrl: "https://gitbags.fm/og.png",
      }).success,
    ).toBe(false);

    expect(
      CreateProjectBodySchema.safeParse({
        ...validBody,
        description: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });

  it("requires social links to be full URLs when present", () => {
    expect(
      CreateProjectBodySchema.safeParse({
        ...validBody,
        twitter: "@symbiex",
      }).success,
    ).toBe(false);

    expect(
      CreateProjectBodySchema.safeParse({
        ...validBody,
        twitter: "https://x.com/symbiex",
        telegram: "https://t.me/gitbags",
      }).success,
    ).toBe(true);
  });
});
