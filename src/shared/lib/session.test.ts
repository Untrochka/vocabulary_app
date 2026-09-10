import { describe, it, expect } from "vitest";
import { pickNewToLearn } from "./session";
import { EMPTY_SRS } from "./srs";
import type { Word } from "@/entities/word/model";

function word(id: string, priority: number, batchId: string | null = null): Word {
  return {
    id, word: id, tr1: `t-${id}`, tr2: "", ipa: "", example: "",
    status: "Не изучен", strength: 0, learnedAt: null,
    passive: EMPTY_SRS, active: EMPTY_SRS,
    priority, frequency: null, ieltsRelevant: null, activeWorthy: null, gradeReason: null, gradedAt: null,
    correctStreak: 0, lapses: 0, debtSince: null, firstSeenAt: null, batchId,
  };
}

describe("pickNewToLearn", () => {
  it("sorts by priority, highest first, when there's no practice batch involved", () => {
    const picked = pickNewToLearn([word("low", 10), word("high", 90), word("mid", 50)], 8, 0);
    expect(picked.map((w) => w.id)).toEqual(["high", "mid", "low"]);
  });

  it("caps at the daily limit", () => {
    const words = Array.from({ length: 10 }, (_, i) => word(`w${i}`, i));
    expect(pickNewToLearn(words, 3, 0)).toHaveLength(3);
  });

  it("debt shrinks the cap", () => {
    const words = Array.from({ length: 10 }, (_, i) => word(`w${i}`, i));
    expect(pickNewToLearn(words, 8, 5)).toHaveLength(3);
  });

  it("debt never pushes the cap below 0", () => {
    const words = Array.from({ length: 10 }, (_, i) => word(`w${i}`, i));
    expect(pickNewToLearn(words, 8, 20)).toHaveLength(0);
  });

  it("regression: a low-priority batch word is not bumped out by a higher-priority regular word", () => {
    // The actual bug: an already-graded, high-frequency regular word (90)
    // outscored a freshly-added, ungraded batch word (30) and silently
    // pushed it out of an 8-slot cap that had plenty of other regular words
    // to fill it anyway.
    const words = [
      ...Array.from({ length: 10 }, (_, i) => word(`regular${i}`, 90 - i)), // 90..81
      word("batchWord", 30, "batch-1"),
    ];
    const picked = pickNewToLearn(words, 8, 0);
    expect(picked.some((w) => w.id === "batchWord")).toBe(true);
    expect(picked[0].id).toBe("batchWord"); // batch words go first, unconditionally
  });

  it("raises the cap to fit a batch bigger than the usual daily allowance", () => {
    const batch = Array.from({ length: 12 }, (_, i) => word(`batch${i}`, 10, "batch-1"));
    const picked = pickNewToLearn(batch, 8, 0);
    expect(picked).toHaveLength(12);
  });

  it("a batch smaller than the cap still leaves room for regular words", () => {
    const words = [
      word("batch0", 20, "batch-1"),
      word("batch1", 20, "batch-1"),
      ...Array.from({ length: 10 }, (_, i) => word(`regular${i}`, 50)),
    ];
    const picked = pickNewToLearn(words, 8, 0);
    expect(picked).toHaveLength(8);
    expect(picked.slice(0, 2).map((w) => w.id).sort()).toEqual(["batch0", "batch1"]);
  });

  it("a practice batch overrides a debt-shrunk cap rather than being limited by it", () => {
    const batch = Array.from({ length: 5 }, (_, i) => word(`batch${i}`, 10, "batch-1"));
    // cap would be 8 - 6 debt = clamped to 0 without a batch in play
    expect(pickNewToLearn(batch, 8, 6)).toHaveLength(5);
  });
});
