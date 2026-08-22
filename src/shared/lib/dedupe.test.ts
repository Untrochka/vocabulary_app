import { describe, it, expect } from "vitest";
import { findMatches, normalizeWord } from "./dedupe";

const deck = [
  { id: "1", word: "harvest" },
  { id: "2", word: "Narrow" },
  { id: "3", word: "walked" },
];

describe("normalizeWord", () => {
  it("lowercases and trims", () => {
    expect(normalizeWord("  Harvest  ")).toBe("harvest");
  });

  it("normalizes through the same lemmatizer the backend uses on add", () => {
    expect(normalizeWord("walk")).toBe(normalizeWord("walked"));
  });
});

describe("findMatches", () => {
  it("finds an exact (case-insensitive) match", () => {
    expect(findMatches("harvest", deck).map((m) => m.id)).toEqual(["1"]);
    expect(findMatches("HARVEST", deck).map((m) => m.id)).toEqual(["1"]);
  });

  it("matches regardless of stored casing", () => {
    expect(findMatches("narrow", deck).map((m) => m.id)).toEqual(["2"]);
  });

  it("matches a base form against an already-inflected entry", () => {
    expect(findMatches("walk", deck).map((m) => m.id)).toEqual(["3"]);
  });

  it("returns nothing for a genuinely new word", () => {
    expect(findMatches("coconut fibre", deck)).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(findMatches("", deck)).toEqual([]);
    expect(findMatches("   ", deck)).toEqual([]);
  });
});
