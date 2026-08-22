import { describe, it, expect } from "vitest";
import { parseEntry } from "./parseEntry";

describe("parseEntry", () => {
  it("extracts the part of speech in parentheses", () => {
    expect(parseEntry("bank (noun)")).toEqual({ word: "bank", pos: "noun" });
  });

  it("extracts the part of speech in square brackets", () => {
    expect(parseEntry("bank [noun]")).toEqual({ word: "bank", pos: "noun" });
  });

  it("returns just the word when there is no annotation", () => {
    expect(parseEntry("harvest")).toEqual({ word: "harvest" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseEntry("  to elaborate  ")).toEqual({ word: "to elaborate" });
  });
});
