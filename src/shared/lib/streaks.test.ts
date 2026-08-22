import { describe, it, expect } from "vitest";
import { computeStreakDisplay } from "./streaks";

describe("computeStreakDisplay", () => {
  it("shows none when the streak was never started", () => {
    expect(computeStreakDisplay({ current: 0, best: 0, lastActiveDate: null }, "2026-08-17")).toEqual({
      current: 0, best: 0, status: "none",
    });
  });

  it("shows active when today's minimum was already met", () => {
    expect(computeStreakDisplay({ current: 5, best: 5, lastActiveDate: "2026-08-17" }, "2026-08-17")).toEqual({
      current: 5, best: 5, status: "active",
    });
  });

  it("shows atRisk when yesterday was the last active day (streak still extendable today)", () => {
    expect(computeStreakDisplay({ current: 5, best: 5, lastActiveDate: "2026-08-16" }, "2026-08-17")).toEqual({
      current: 5, best: 5, status: "atRisk",
    });
  });

  it("shows broken (current reset to 0, best preserved) when more than a day was missed — no guilt, just a fact", () => {
    expect(computeStreakDisplay({ current: 5, best: 9, lastActiveDate: "2026-08-10" }, "2026-08-17")).toEqual({
      current: 0, best: 9, status: "broken",
    });
  });
});
