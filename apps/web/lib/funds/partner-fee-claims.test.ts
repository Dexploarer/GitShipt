import { describe, expect, it } from "vitest";
import { derivePartnerClaimDeltas } from "./accounting";

describe("derivePartnerClaimDeltas", () => {
  it("tracks claimed and unclaimed partner-fee movement", () => {
    expect(
      derivePartnerClaimDeltas(
        { claimedFees: "100", unclaimedFees: "900" },
        { claimedFees: "1000", unclaimedFees: "0" },
      ),
    ).toEqual({
      claimedDeltaLamports: 900n,
      unclaimedDeltaLamports: -900n,
    });
  });
});
