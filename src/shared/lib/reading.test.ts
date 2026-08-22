import { describe, it, expect, afterEach, vi } from "vitest";
import { pickReadingWords, generateStory, READING_MAX_WORDS } from "./reading";
import { EMPTY_SRS } from "./srs";
import { CAPS } from "@/shared/config/app";
import type { SessionCard, SessionResponse } from "@/entities/session/model";

function makeCard(id: string, word: string, tr1 = `перевод-${id}`): SessionCard {
  return { id, word, tr1, tr2: "", ipa: "", example: "", strength: 0, passive: EMPTY_SRS, active: EMPTY_SRS };
}

function makeSession(parts: Partial<Pick<SessionResponse, "newToLearn" | "newActive" | "duePassive" | "dueActive">>): SessionResponse {
  return {
    newToLearn: [], newActive: [], duePassive: [], dueActive: [],
    counts: { total: 0, mastered: 0, learning: 0 },
    caps: CAPS,
    today: { passive: 0, active: 0 },
    laterToday: { count: 0, nextAt: null },
    ...parts,
  };
}

describe("pickReadingWords", () => {
  it("pulls from newToLearn first, then newActive/duePassive/dueActive", () => {
    const session = makeSession({
      newToLearn: [makeCard("1", "harvest")],
      newActive: [makeCard("2", "narrow")],
      duePassive: [makeCard("3", "elaborate")],
      dueActive: [makeCard("4", "clarity")],
    });
    expect(pickReadingWords(session).map((w) => w.word)).toEqual(["harvest", "narrow", "elaborate", "clarity"]);
  });

  it("dedupes the same word id across pools", () => {
    const shared = makeCard("1", "harvest");
    const session = makeSession({ newToLearn: [shared], duePassive: [shared] });
    expect(pickReadingWords(session)).toHaveLength(1);
  });

  it("skips words without a translation — nothing for the model to ground the story in", () => {
    const session = makeSession({ newToLearn: [makeCard("1", "harvest", "")] });
    expect(pickReadingWords(session)).toHaveLength(0);
  });

  it("caps at READING_MAX_WORDS regardless of how many are actually due", () => {
    const dueActive = Array.from({ length: READING_MAX_WORDS + 10 }, (_, i) => makeCard(String(i), `word${i}`));
    const session = makeSession({ dueActive });
    expect(pickReadingWords(session)).toHaveLength(READING_MAX_WORDS);
  });
});

describe("generateStory", () => {
  const originalKey = process.env.GROQ_API_KEY;
  afterEach(() => { process.env.GROQ_API_KEY = originalKey; });

  it("fails clearly instead of calling the network when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;
    await expect(generateStory([{ word: "harvest", tr1: "урожай" }])).rejects.toThrow(/GROQ_API_KEY/);
  });
});

describe("generateStory retry on transient Groq errors", () => {
  const originalKey = process.env.GROQ_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.GROQ_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("retries once on a 503 and succeeds on the second attempt", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.useFakeTimers();
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) return new Response("temporarily overloaded", { status: 503 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "A short story." } }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const promise = generateStory([{ word: "harvest", tr1: "урожай" }]);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBe("A short story.");
    expect(calls).toBe(2);
  });

  it("does not retry a non-transient 400 — that fails the same way twice", async () => {
    process.env.GROQ_API_KEY = "test-key";
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls++;
      return new Response("invalid model", { status: 400 });
    }) as unknown as typeof fetch;

    await expect(generateStory([{ word: "harvest", tr1: "урожай" }])).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });
});
