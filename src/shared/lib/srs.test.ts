import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EMPTY_SRS,
  review,
  strength,
  isDue,
  addDays,
  todayISO,
  nextIntervalLabel,
  formatDueIn,
  LEARNING_STEPS_MIN,
  FIXED_DAYS,
  type SrsState,
} from "./srs";

describe("review — same-day learning steps", () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-07-15T10:00:00.000Z")));
  afterEach(() => vi.useRealTimers());

  it("first pass on a brand-new card comes back in ~20 minutes, not tomorrow", () => {
    const result = review(EMPTY_SRS, 2);
    expect(result.reps).toBe(1);
    expect(result.interval).toBe(0);
    expect(result.due).toBe(new Date("2026-07-15T10:20:00.000Z").toISOString());
  });

  it("second same-day pass comes back in ~3 hours", () => {
    const afterFirst = review(EMPTY_SRS, 2);
    const result = review(afterFirst, 2);
    expect(result.reps).toBe(2);
    expect(result.due).toBe(new Date("2026-07-15T13:00:00.000Z").toISOString());
  });

  it("third same-day pass comes back in ~8 hours", () => {
    const afterFirst = review(EMPTY_SRS, 2);
    const afterSecond = review(afterFirst, 2);
    const result = review(afterSecond, 2);
    expect(result.reps).toBe(3);
    expect(result.due).toBe(new Date("2026-07-15T18:00:00.000Z").toISOString());
  });

  it("graduates to the fixed 1-day interval only after all same-day steps are done", () => {
    let s: SrsState = EMPTY_SRS;
    for (let i = 0; i <= LEARNING_STEPS_MIN.length; i++) s = review(s, 2);
    expect(s.reps).toBe(LEARNING_STEPS_MIN.length + 1);
    expect(s.interval).toBe(1);
    expect(s.due).toBe(addDays(todayISO(), 1));
  });

  it("Again always resets to the ~20 minute lapse, even mid-steps", () => {
    const afterFirst = review(EMPTY_SRS, 2);
    const result = review(afterFirst, 0);
    expect(result.reps).toBe(0);
    expect(result.interval).toBe(0);
    expect(result.due).toBe(new Date("2026-07-15T10:20:00.000Z").toISOString());
  });
});

describe("review — fixed graduation ladder (1 → 3 → 7 → 14)", () => {
  function graduate(): SrsState {
    let s: SrsState = EMPTY_SRS;
    for (let i = 0; i <= LEARNING_STEPS_MIN.length; i++) s = review(s, 2);
    return s; // interval 1, freshly graduated
  }

  it("walks 1 → 3 → 7 → 14 regardless of grade", () => {
    let s = graduate();
    expect(s.interval).toBe(FIXED_DAYS[0]);
    s = review(s, 2);
    expect(s.interval).toBe(FIXED_DAYS[1]);
    s = review(s, 1);
    expect(s.interval).toBe(FIXED_DAYS[2]);
    s = review(s, 3);
    expect(s.interval).toBe(FIXED_DAYS[3]);
  });

  it("keeps growing by ease after the fixed ladder ends", () => {
    let s = graduate();
    for (let i = 0; i < FIXED_DAYS.length; i++) s = review(s, 2); // exhaust 1, 3, 7, 14
    const result = review(s, 2);
    expect(result.interval).toBeGreaterThan(14);
  });

  it("Easy still grows the interval more than Good once past the fixed ladder", () => {
    let base = graduate();
    for (let i = 0; i < FIXED_DAYS.length; i++) base = review(base, 2);
    const good = review(base, 2).interval;
    const easy = review(base, 3).interval;
    expect(easy).toBeGreaterThan(good);
  });

  it("Again lapses a graduated card back to the ~20 minute review", () => {
    const s = graduate();
    const result = review(s, 0);
    expect(result.reps).toBe(0);
    expect(result.interval).toBe(0);
  });

  it("never produces a zero or negative interval once past the fixed ladder", () => {
    const brittle: SrsState = { reps: 20, interval: 1, ease: 1.3, due: todayISO(), last: todayISO() };
    const result = review(brittle, 1);
    expect(result.interval).toBeGreaterThanOrEqual(1);
  });
});

describe("isDue", () => {
  it("is false for a card that was never studied (reps 0)", () => {
    expect(isDue(EMPTY_SRS)).toBe(false);
  });

  it("is false for a future due date/time", () => {
    const future: SrsState = { reps: 1, interval: 1, ease: 2.5, due: addDays(todayISO(), 5), last: todayISO() };
    expect(isDue(future)).toBe(false);
  });

  it("is true once the due timestamp has passed, whether date-only or datetime", () => {
    const dateOnly: SrsState = { reps: 1, interval: 1, ease: 2.5, due: "2020-01-01", last: "2019-12-31" };
    const withTime: SrsState = { reps: 1, interval: 0, ease: 2.3, due: "2020-01-01T00:20:00.000Z", last: "2020-01-01" };
    expect(isDue(dateOnly, new Date("2025-01-01"))).toBe(true);
    expect(isDue(withTime, new Date("2025-01-01"))).toBe(true);
  });
});

describe("strength", () => {
  it("is 0 for an unstudied card", () => {
    expect(strength(EMPTY_SRS)).toBe(0);
  });

  it("caps at 100 for intervals at or beyond 30 days", () => {
    expect(strength({ ...EMPTY_SRS, reps: 5, interval: 30 })).toBe(100);
    expect(strength({ ...EMPTY_SRS, reps: 5, interval: 90 })).toBe(100);
  });

  it("scales linearly below the cap", () => {
    expect(strength({ ...EMPTY_SRS, reps: 5, interval: 15 })).toBe(50);
  });
});

describe("nextIntervalLabel", () => {
  it("shows a minute-based preview during the first same-day step", () => {
    expect(nextIntervalLabel(EMPTY_SRS, 2)).toMatch(/min$/);
  });

  it("shows an hour-based preview for the later same-day steps", () => {
    const afterFirst = review(EMPTY_SRS, 2);
    expect(nextIntervalLabel(afterFirst, 2)).toMatch(/h$/);
  });

  it("shows a day-based preview once graduated", () => {
    let s: SrsState = EMPTY_SRS;
    for (let i = 0; i <= LEARNING_STEPS_MIN.length; i++) s = review(s, 2);
    expect(nextIntervalLabel(s, 2)).toBe("3 days");
  });
});

describe("formatDueIn", () => {
  const now = new Date("2026-07-15T10:00:00.000Z");

  it("shows minutes for a near-future due", () => {
    expect(formatDueIn(new Date("2026-07-15T10:20:00.000Z").toISOString(), now)).toBe("20 min");
  });

  it("shows hours for a same-day-but-later due", () => {
    expect(formatDueIn(new Date("2026-07-15T18:00:00.000Z").toISOString(), now)).toBe("8 h");
  });

  it("shows days for a due more than a day out", () => {
    expect(formatDueIn(addDays(todayISO(now), 3) + "T00:00:00.000Z", now)).toMatch(/d$/);
  });
});
