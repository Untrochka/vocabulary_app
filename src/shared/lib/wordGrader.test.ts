import { describe, it, expect, afterEach, vi } from "vitest";
import { parseGradeResponse, gradeWordBatch } from "./wordGrader";

describe("parseGradeResponse", () => {
  it("parses a clean array response into a map keyed by lowercased word", () => {
    const raw = JSON.stringify([
      { word: "Run", frequency: 95, ieltsRelevant: false, activeWorthy: true, reason: "everyday verb" },
      { word: "defenestrate", frequency: 2, ieltsRelevant: false, activeWorthy: false, reason: "obscure, passive only" },
    ]);
    const grades = parseGradeResponse(raw);
    expect(grades.get("run")).toEqual({ frequency: 95, ieltsRelevant: false, activeWorthy: true, reason: "everyday verb" });
    expect(grades.get("defenestrate")?.activeWorthy).toBe(false);
  });

  it("extracts the array even when the model wraps it in extra prose", () => {
    const raw = `Sure, here you go:\n${JSON.stringify([{ word: "go", frequency: 100, ieltsRelevant: false, activeWorthy: true, reason: "core verb" }])}\nHope that helps!`;
    const grades = parseGradeResponse(raw);
    expect(grades.get("go")?.frequency).toBe(100);
  });

  it("clamps out-of-range frequency into 1..100", () => {
    const raw = JSON.stringify([
      { word: "a", frequency: 500, ieltsRelevant: true, activeWorthy: true, reason: "x" },
      { word: "b", frequency: -10, ieltsRelevant: true, activeWorthy: true, reason: "x" },
    ]);
    const grades = parseGradeResponse(raw);
    expect(grades.get("a")?.frequency).toBe(100);
    expect(grades.get("b")?.frequency).toBe(1);
  });

  it("drops entries with no word or a non-numeric frequency instead of throwing", () => {
    const raw = JSON.stringify([
      { word: "", frequency: 50, ieltsRelevant: true, activeWorthy: true, reason: "x" },
      { word: "ok", frequency: "not a number", ieltsRelevant: true, activeWorthy: true, reason: "x" },
      { word: "fine", frequency: 40, ieltsRelevant: false, activeWorthy: false, reason: "x" },
    ]);
    const grades = parseGradeResponse(raw);
    expect(grades.size).toBe(1);
    expect(grades.has("fine")).toBe(true);
  });

  it("throws when there's no JSON array to find at all", () => {
    expect(() => parseGradeResponse("I refuse to answer in JSON.")).toThrow(/JSON array/);
  });
});

describe("gradeWordBatch", () => {
  const originalKey = process.env.GROQ_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.GROQ_API_KEY = originalKey;
    global.fetch = originalFetch;
  });

  it("returns an empty map without calling Groq for an empty batch", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const grades = await gradeWordBatch([]);
    expect(grades.size).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends the words and parses Groq's graded response", async () => {
    process.env.GROQ_API_KEY = "test-key";
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { word: "narrow", frequency: 70, ieltsRelevant: true, activeWorthy: true, reason: "common adjective" },
                ]),
              },
            },
          ],
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const grades = await gradeWordBatch([{ word: "narrow", tr1: "узкий" }]);
    expect(grades.get("narrow")).toEqual({ frequency: 70, ieltsRelevant: true, activeWorthy: true, reason: "common adjective" });
  });
});
