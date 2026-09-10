import { describe, it, expect } from "vitest";
import { computeReviewOutcome } from "./reviewOutcome";
import { EMPTY_SRS, todayISO } from "./srs";
import type { Word } from "@/entities/word/model";

function word(over: Partial<Word> = {}): Word {
  return {
    id: "w1", word: "test", tr1: "тест", tr2: "", ipa: "", example: "",
    status: "Не изучен", strength: 0, learnedAt: null,
    passive: EMPTY_SRS, active: EMPTY_SRS,
    priority: 0, frequency: 50, ieltsRelevant: false, activeWorthy: true, gradeReason: null, gradedAt: null,
    correctStreak: 0, lapses: 0, debtSince: null, firstSeenAt: null, firstActiveAt: null, batchId: null,
    ...over,
  };
}

describe("computeReviewOutcome", () => {
  it("sets firstActiveAt on the very first active review, and only then", () => {
    const first = computeReviewOutcome(word({ active: EMPTY_SRS }), { kind: "review", mode: "active", grade: 2 });
    expect(first.fields.firstActiveAt).toBe(todayISO());

    const second = computeReviewOutcome(
      word({ active: { ...EMPTY_SRS, reps: 1 }, firstActiveAt: "2026-01-01" }),
      { kind: "review", mode: "active", grade: 2 }
    );
    expect(second.fields.firstActiveAt).toBeUndefined(); // not overwritten
  });

  it("a grade-0 active review resets correctStreak, adds a lapse, and opens debt", () => {
    const out = computeReviewOutcome(
      word({ active: { ...EMPTY_SRS, reps: 3 }, correctStreak: 3, lapses: 1 }),
      { kind: "review", mode: "active", grade: 0 }
    );
    expect(out.fields.correctStreak).toBe(0);
    expect(out.fields.lapses).toBe(2);
    expect(out.fields.debtSince).not.toBeNull();
    expect(out.fields.status).toBe("Выбран для активного изучения");
  });

  it("a correct active review clears existing debt and grows the streak", () => {
    const out = computeReviewOutcome(
      word({ active: { ...EMPTY_SRS, reps: 3 }, correctStreak: 3, debtSince: "2026-01-01" }),
      { kind: "review", mode: "active", grade: 2 }
    );
    expect(out.fields.correctStreak).toBe(4);
    expect(out.fields.debtSince).toBeNull();
  });

  it("status flips to fully mastered only once both the streak and interval bars clear", () => {
    // interval reaches 14 via the fixed ladder (1,3,7,14) on the 4th post-same-day review
    let w = word({ correctStreak: 3, active: { reps: 6, interval: 7, ease: 2.8, due: null, last: null } });
    const out = computeReviewOutcome(w, { kind: "review", mode: "active", grade: 2 });
    expect(out.fields.active?.interval).toBe(14);
    expect(out.fields.correctStreak).toBe(4);
    expect(out.fields.status).toBe("Изучен активно");
  });

  it("passive reviews and 'learn' never touch correctStreak/lapses — only active does", () => {
    const learned = computeReviewOutcome(word({ correctStreak: 2, lapses: 1 }), { kind: "learn", grade: 2 });
    expect(learned.fields.correctStreak).toBe(2);
    expect(learned.fields.lapses).toBe(1);

    const passive = computeReviewOutcome(
      word({ correctStreak: 2, lapses: 1, passive: { ...EMPTY_SRS, reps: 1 } }),
      { kind: "review", mode: "passive", grade: 0 }
    );
    expect(passive.fields.correctStreak).toBe(2);
    expect(passive.fields.lapses).toBe(1);
    expect(passive.fields.debtSince).not.toBeNull(); // debt still opens from a passive miss
  });

  it("priority is recomputed using the outcome's own correctStreak/debtSince, not the word's old ones", () => {
    const out = computeReviewOutcome(
      word({ frequency: 100, ieltsRelevant: true, correctStreak: 1, active: { ...EMPTY_SRS, reps: 2 } }),
      { kind: "review", mode: "active", grade: 2 } // -> correctStreak becomes 2, the "almost learned" threshold
    );
    // 100*0.35 + 15 (ielts) + 25 (almostLearned, streak now 2) = 75
    expect(out.fields.priority).toBe(75);
  });
});
