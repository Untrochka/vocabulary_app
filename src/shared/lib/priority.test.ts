import { describe, it, expect } from "vitest";
import { computePriority, type PriorityInput } from "./priority";

const base: PriorityInput = {
  frequency: null,
  ieltsRelevant: null,
  correctStreak: 0,
  batchId: null,
  firstSeenAt: null,
  debtSince: null,
};

describe("computePriority", () => {
  it("is 0 for an ungraded, untouched word", () => {
    expect(computePriority(base)).toBe(0);
  });

  it("scales with frequency alone, capped around a third of the scale", () => {
    expect(computePriority({ ...base, frequency: 100 })).toBe(35);
    expect(computePriority({ ...base, frequency: 50 })).toBe(18); // 17.5 rounds to 18
    expect(computePriority({ ...base, frequency: 1 })).toBe(0); // 0.35 rounds to 0
  });

  it("adds a flat bonus for IELTS relevance", () => {
    expect(computePriority({ ...base, ieltsRelevant: true })).toBe(15);
    expect(computePriority({ ...base, frequency: 100, ieltsRelevant: true })).toBe(50);
  });

  it("boosts almost-learned words (streak >= 2), not words just getting started", () => {
    expect(computePriority({ ...base, correctStreak: 1 })).toBe(0);
    expect(computePriority({ ...base, correctStreak: 2 })).toBe(25);
    expect(computePriority({ ...base, correctStreak: 5 })).toBe(25); // doesn't keep growing past the threshold
  });

  it("debt outweighs everything else on its own", () => {
    expect(computePriority({ ...base, debtSince: "2026-09-01" })).toBe(40);
  });

  it("practice-batch freshness decays linearly over 7 days, then hits 0", () => {
    const input: PriorityInput = { ...base, batchId: "batch-1", firstSeenAt: "2026-09-01" };
    expect(computePriority(input, "2026-09-01")).toBe(30); // added today — full freshness
    expect(computePriority(input, "2026-09-04")).toBe(17); // ~half decayed (3/7 days)
    expect(computePriority(input, "2026-09-08")).toBe(0); // past the 7-day window
  });

  it("a word with no batchId gets no freshness boost even with firstSeenAt set", () => {
    expect(computePriority({ ...base, firstSeenAt: "2026-09-01" }, "2026-09-01")).toBe(0);
  });

  it("clamps the total to 100 even when every factor stacks", () => {
    const stacked: PriorityInput = {
      frequency: 100,
      ieltsRelevant: true,
      correctStreak: 3,
      batchId: "batch-1",
      firstSeenAt: "2026-09-01",
      debtSince: "2026-09-01",
    };
    expect(computePriority(stacked, "2026-09-01")).toBe(100);
  });
});
