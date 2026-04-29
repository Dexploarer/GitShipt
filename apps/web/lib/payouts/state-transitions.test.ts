import { describe, expect, it } from "vitest";

import {
  ALLOWED_PAYOUT_TRANSITIONS,
  assertValidPayoutTransition,
  isValidPayoutTransition,
  PayoutStatusTransitionError,
  type PayoutStatus,
} from "./state-transitions";

const ALL: PayoutStatus[] = [
  "pending",
  "claiming",
  "distributing",
  "completed",
  "failed",
  "cancelled",
  "simulated",
];

describe("payout state machine", () => {
  it("allows the documented forward edges", () => {
    expect(isValidPayoutTransition("pending", "claiming")).toBe(true);
    expect(isValidPayoutTransition("pending", "cancelled")).toBe(true);
    expect(isValidPayoutTransition("pending", "simulated")).toBe(true);
    expect(isValidPayoutTransition("pending", "failed")).toBe(true);
    expect(isValidPayoutTransition("claiming", "distributing")).toBe(true);
    expect(isValidPayoutTransition("claiming", "failed")).toBe(true);
    expect(isValidPayoutTransition("claiming", "completed")).toBe(true);
    expect(isValidPayoutTransition("distributing", "completed")).toBe(true);
    expect(isValidPayoutTransition("distributing", "failed")).toBe(true);
    expect(isValidPayoutTransition("failed", "claiming")).toBe(true);
    expect(isValidPayoutTransition("failed", "cancelled")).toBe(true);
    expect(isValidPayoutTransition("failed", "simulated")).toBe(true);
  });

  it("rejects regressions out of completed / cancelled / simulated", () => {
    for (const terminal of ["completed", "cancelled", "simulated"] as const) {
      for (const target of ALL) {
        if (target === terminal) continue;
        expect(isValidPayoutTransition(terminal, target)).toBe(false);
      }
    }
  });

  it("rejects completed -> pending and completed -> claiming", () => {
    expect(isValidPayoutTransition("completed", "pending")).toBe(false);
    expect(isValidPayoutTransition("completed", "claiming")).toBe(false);
  });

  it("rejects distributing -> pending or distributing -> claiming", () => {
    expect(isValidPayoutTransition("distributing", "pending")).toBe(false);
    expect(isValidPayoutTransition("distributing", "claiming")).toBe(false);
    expect(isValidPayoutTransition("distributing", "cancelled")).toBe(false);
  });

  it("treats same-status updates as valid (no-op)", () => {
    for (const s of ALL) {
      expect(isValidPayoutTransition(s, s)).toBe(true);
    }
  });

  it("assertValidPayoutTransition throws PayoutStatusTransitionError on illegal moves", () => {
    expect(() =>
      assertValidPayoutTransition("completed", "pending"),
    ).toThrowError(PayoutStatusTransitionError);
  });

  it("transition table covers every PayoutStatus key", () => {
    for (const s of ALL) {
      expect(ALLOWED_PAYOUT_TRANSITIONS[s]).toBeDefined();
    }
  });
});
