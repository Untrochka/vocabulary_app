import { describe, it, expect, afterEach, vi } from "vitest";
import { listActiveDays, pickRecallWords, firstLetterHint, judgeRecallAnswer, RECALL_GRADE } from "./recall";
import { EMPTY_SRS } from "./srs";
import type { Word } from "@/entities/word/model";

function word(id: string, firstActiveAt: string | null, tr1 = `t-${id}`): Word {
  return {
    id, word: id, tr1, tr2: "", ipa: "", example: "",
    status: "Выбран для активного изучения", strength: 0, learnedAt: null,
    passive: EMPTY_SRS, active: EMPTY_SRS,
    priority: 0, frequency: null, ieltsRelevant: null, activeWorthy: true, gradeReason: null, gradedAt: null,
    correctStreak: 0, lapses: 0, debtSince: null, firstSeenAt: null, firstActiveAt, batchId: null,
  };
}

describe("listActiveDays", () => {
  it("counts words per day and sorts most-recent first", () => {
    const words = [word("a", "2026-08-20"), word("b", "2026-08-21"), word("c", "2026-08-20")];
    expect(listActiveDays(words)).toEqual([
      { date: "2026-08-21", count: 1 },
      { date: "2026-08-20", count: 2 },
    ]);
  });

  it("excludes words that never had a first active review", () => {
    expect(listActiveDays([word("a", null)])).toEqual([]);
  });
});

describe("pickRecallWords", () => {
  it("only returns words whose first active review matches the given day", () => {
    const words = [word("a", "2026-08-20"), word("b", "2026-08-21")];
    expect(pickRecallWords(words, "2026-08-20").map((w) => w.id)).toEqual(["a"]);
  });

  it("never includes the word or even its translation — only the id", () => {
    const words = [word("a", "2026-08-20")];
    expect(pickRecallWords(words, "2026-08-20")[0]).toEqual({ id: "a" });
  });
});

describe("RECALL_GRADE", () => {
  it("maps verdicts to the same grade scale the active track already uses", () => {
    expect(RECALL_GRADE.correct).toBe(3);
    expect(RECALL_GRADE.partial).toBe(2);
    expect(RECALL_GRADE.wrong).toBe(0);
  });
});

describe("firstLetterHint", () => {
  it("returns just the first letter, uppercased", () => {
    expect(firstLetterHint("narrow")).toBe("N");
  });
});

describe("judgeRecallAnswer", () => {
  const originalKey = process.env.GROQ_API_KEY;
  const originalFetch = global.fetch;
  afterEach(() => {
    process.env.GROQ_API_KEY = originalKey;
    global.fetch = originalFetch;
  });

  it("parses a valid verdict + feedback response", async () => {
    process.env.GROQ_API_KEY = "test-key";
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{"verdict":"correct","feedback":"Верно, это то самое слово, и смысл понят."}' } }] }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const result = await judgeRecallAnswer("narrow", "узкий", "narrow", "when something is not wide");
    expect(result).toEqual({ verdict: "correct", feedback: "Верно, это то самое слово, и смысл понят." });
  });

  it("throws on an unrecognized verdict instead of silently accepting it", async () => {
    process.env.GROQ_API_KEY = "test-key";
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"verdict":"maybe","feedback":"..."}' } }] }), { status: 200 })
    ) as unknown as typeof fetch;

    await expect(judgeRecallAnswer("narrow", "узкий", "narrow", "not sure")).rejects.toThrow(/unrecognized verdict/);
  });
});
