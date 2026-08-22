import { describe, it, expect } from "vitest";
import { buildStudyQueue } from "./studyQueue";
import { EMPTY_SRS } from "./srs";
import type { SessionCard } from "@/entities/session/model";

function card(word: string): SessionCard {
  return { id: word, word, tr1: word, tr2: "", ipa: "", example: "", strength: 0, passive: EMPTY_SRS, active: EMPTY_SRS };
}

describe("buildStudyQueue", () => {
  it("returns an empty queue when there is nothing to do", () => {
    expect(buildStudyQueue({ newToLearn: [], duePassive: [], newActive: [], dueActive: [] })).toEqual([]);
  });

  it("splits new-word batches into show+check pairs, in learnBatchSize (5) chunks", () => {
    const words = Array.from({ length: 7 }, (_, i) => card(`w${i}`));
    const q = buildStudyQueue({ newToLearn: words, duePassive: [], newActive: [], dueActive: [] });
    // 7 слов -> чанки [5, 2], каждое даёт show+check -> (5+5) + (2+2) = 14
    expect(q).toHaveLength(14);
    expect(q.slice(0, 5).map((i) => i.type)).toEqual(Array(5).fill("learnShow"));
    expect(q.slice(5, 10).map((i) => i.type)).toEqual(Array(5).fill("learnCheck"));
    expect(q.slice(10, 12).map((i) => i.type)).toEqual(Array(2).fill("learnShow"));
    expect(q.slice(12, 14).map((i) => i.type)).toEqual(Array(2).fill("learnCheck"));
  });

  it("inserts a divider between new-word learning and passive review, only when both are present", () => {
    const withBoth = buildStudyQueue({ newToLearn: [card("a")], duePassive: [card("b")], newActive: [], dueActive: [] });
    expect(withBoth.map((i) => i.type)).toEqual(["learnShow", "learnCheck", "divider", "passive"]);

    const learnOnly = buildStudyQueue({ newToLearn: [card("a")], duePassive: [], newActive: [], dueActive: [] });
    expect(learnOnly.some((i) => i.type === "divider")).toBe(false);

    const reviewOnly = buildStudyQueue({ newToLearn: [], duePassive: [card("b")], newActive: [], dueActive: [] });
    expect(reviewOnly.some((i) => i.type === "divider")).toBe(false);
  });

  it("orders sections: new-word learning, passive review, new-active learning, active review", () => {
    const q = buildStudyQueue({
      newToLearn: [card("learn1")],
      duePassive: [card("passive1")],
      newActive: [card("newActive1")],
      dueActive: [card("active1")],
    });
    expect(q.map((i) => i.type)).toEqual(["learnShow", "learnCheck", "divider", "passive", "activeLearnShow", "activeLearnCheck", "active"]);
  });

  it("divider items carry word: null, everything else carries the real card", () => {
    const q = buildStudyQueue({ newToLearn: [card("a")], duePassive: [card("b")], newActive: [], dueActive: [] });
    const divider = q.find((i) => i.type === "divider");
    expect(divider?.word).toBeNull();
    expect(q.filter((i) => i.type !== "divider").every((i) => i.word !== null)).toBe(true);
  });
});
