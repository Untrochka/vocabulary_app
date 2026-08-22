import { describe, it, expect } from "vitest";
import { assessWordQuality } from "./wordValidation";

describe("assessWordQuality", () => {
  it("accepts normal words and phrases", () => {
    expect(assessWordQuality("harvest").ok).toBe(true);
    expect(assessWordQuality("to elaborate").ok).toBe(true);
    expect(assessWordQuality("bank").ok).toBe(true);
  });

  it("rejects empty input", () => {
    expect(assessWordQuality("").ok).toBe(false);
    expect(assessWordQuality("   ").ok).toBe(false);
  });

  it("rejects fragments with no vowel", () => {
    expect(assessWordQuality("xzk").ok).toBe(false);
  });

  it("rejects strings with repeated-character noise", () => {
    expect(assessWordQuality("aaaaargh").ok).toBe(false);
  });

  it("rejects non-Latin or symbol-heavy input", () => {
    expect(assessWordQuality("привет").ok).toBe(false);
    expect(assessWordQuality("123").ok).toBe(false);
  });

  it("rejects long sentence-like fragments (likely broken speech-to-text)", () => {
    expect(assessWordQuality("put your fit in it somehow today").ok).toBe(false);
  });

  it("does not reject short but legitimate words", () => {
    expect(assessWordQuality("fel").ok).toBe(true); // структурно валидно — мусорность видна только по отсутствию перевода
  });
});
