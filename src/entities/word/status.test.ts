import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EMPTY_SRS, review, isDue, todayISO, LEARNING_STEPS_MIN, type SrsState } from "@/shared/lib/srs";
import { isActiveMature, countLearnedPassiveToday, countLearnedActiveToday } from "./status";
import type { Word } from "./model";

const CAPS = { activeMatureReps: 5, activeMatureDays: 3 };

function word(over: Partial<Word> = {}): Pick<Word, "learnedAt" | "active"> {
  return { learnedAt: null, active: EMPTY_SRS, ...over };
}

describe("isActiveMature", () => {
  it("is false when neither reps nor interval reached the bar", () => {
    expect(isActiveMature({ ...EMPTY_SRS, reps: 3, interval: 0 }, CAPS.activeMatureReps, CAPS.activeMatureDays)).toBe(false);
  });

  it("is false with enough reps but interval still 0 (mid same-day steps)", () => {
    // Ровно то, из-за чего слова зависали: reps набрался, а interval — ещё нет.
    expect(isActiveMature({ ...EMPTY_SRS, reps: 6, interval: 0 }, CAPS.activeMatureReps, CAPS.activeMatureDays)).toBe(false);
  });

  it("is false with enough interval but not enough reps", () => {
    expect(isActiveMature({ ...EMPTY_SRS, reps: 2, interval: 3 }, CAPS.activeMatureReps, CAPS.activeMatureDays)).toBe(false);
  });

  it("is true once both thresholds are met", () => {
    expect(isActiveMature({ ...EMPTY_SRS, reps: 5, interval: 3 }, CAPS.activeMatureReps, CAPS.activeMatureDays)).toBe(true);
    expect(isActiveMature({ ...EMPTY_SRS, reps: 8, interval: 14 }, CAPS.activeMatureReps, CAPS.activeMatureDays)).toBe(true);
  });
});

describe("countLearnedPassiveToday", () => {
  const today = "2026-08-10";

  it("counts a word once no matter how many same-day steps it went through", () => {
    const words = [word({ learnedAt: today })];
    expect(countLearnedPassiveToday(words, today)).toBe(1);
  });

  it("ignores words learned on other days or not yet learned", () => {
    const words = [word({ learnedAt: "2026-08-09" }), word({ learnedAt: null })];
    expect(countLearnedPassiveToday(words, today)).toBe(0);
  });

  it("regression: reps churning 1→2→3 within the same day must not hide the word from today's count", () => {
    // Раньше считали по passive.reps === 1 — после первого же внутридневного
    // шага (reps становится 2) слово выпадало из подсчёта "выучено сегодня",
    // и дневной кап не расходовался.
    let passive: SrsState = EMPTY_SRS;
    passive = review(passive, 2); // reps 1
    passive = review(passive, 2); // reps 2
    passive = review(passive, 2); // reps 3
    const w = { learnedAt: today, passive };
    expect(countLearnedPassiveToday([w], today)).toBe(1);
  });
});

describe("countLearnedActiveToday", () => {
  const today = "2026-08-10";

  it("counts a word freshly started on the active track today", () => {
    let active: SrsState = EMPTY_SRS;
    active = review(active, 2); // reps 1, last = whatever review() stamps
    const w = word({ active: { ...active, last: today } });
    expect(countLearnedActiveToday([w], today)).toBe(1);
  });

  it("still counts it after it churns through all same-day active steps today", () => {
    let active: SrsState = EMPTY_SRS;
    for (let i = 0; i < LEARNING_STEPS_MIN.length; i++) active = review(active, 2);
    const w = word({ active: { ...active, last: today } });
    expect(countLearnedActiveToday([w], today)).toBe(1);
  });

  it("does not count an old, already-mature word just because it was reviewed today", () => {
    const w = word({ active: { reps: 9, interval: 21, ease: 2.6, due: today, last: today } });
    expect(countLearnedActiveToday([w], today)).toBe(0);
  });

  it("does not count a word whose active track wasn't touched today", () => {
    const w = word({ active: { reps: 1, interval: 0, ease: 2.5, due: today, last: "2026-08-09" } });
    expect(countLearnedActiveToday([w], today)).toBe(0);
  });
});

describe("a word learned today keeps coming back and eventually matures (no silent drops)", () => {
  it("passive: same-day steps → graduates → due again on schedule", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-10T09:00:00.000Z"));
    let passive: SrsState = EMPTY_SRS;

    // 3 внутридневных шага + переход на дневной график — слово всё время
    // остаётся "due" в будущем, никогда не теряется.
    for (let i = 0; i <= LEARNING_STEPS_MIN.length; i++) {
      vi.setSystemTime(new Date(passive.due ?? Date.now()));
      passive = review(passive, 2);
      expect(passive.due).not.toBeNull();
    }
    expect(passive.interval).toBe(1); // выпустилось на дневной график

    // Уже на ступени 1 дня — проходим ещё 3 → 7, каждый раз проверяя, что
    // слово реально "due" именно в свой день, а не потерялось.
    for (const _ of [1, 2]) {
      vi.setSystemTime(new Date(passive.due + "T12:00:00.000Z"));
      expect(isDue(passive, new Date(passive.due + "T12:00:00.000Z"))).toBe(true);
      passive = review(passive, 2);
    }
    expect(passive.interval).toBe(7);

    vi.useRealTimers();
  });

  it("active: only becomes 'Изучен активно' once it survives the real interval, not just clicks", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-10T09:00:00.000Z"));
    let active: SrsState = EMPTY_SRS;

    for (let i = 0; i < LEARNING_STEPS_MIN.length; i++) {
      vi.setSystemTime(new Date(active.due ?? Date.now()));
      active = review(active, 2);
      expect(isActiveMature(active, CAPS.activeMatureReps, CAPS.activeMatureDays)).toBe(false);
    }

    // Ступень лестницы 1: должно быть 5-е успешное повторение и interval>=3, чтобы созреть.
    vi.setSystemTime(new Date(active.due ?? Date.now()));
    active = review(active, 2); // reps 4, interval 1
    expect(isActiveMature(active, CAPS.activeMatureReps, CAPS.activeMatureDays)).toBe(false);

    vi.setSystemTime(new Date(active.due + "T12:00:00.000Z"));
    active = review(active, 2); // reps 5, interval 3
    expect(active.reps).toBe(5);
    expect(active.interval).toBe(3);
    expect(isActiveMature(active, CAPS.activeMatureReps, CAPS.activeMatureDays)).toBe(true);

    vi.useRealTimers();
  });
});
