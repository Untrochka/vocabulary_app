import { describe, it, expect } from "vitest";
import { lemmatize } from "./lemmatize";

describe("lemmatize", () => {
  it("maps irregular past tense to the infinitive", () => {
    expect(lemmatize("was")).toBe("be");
    expect(lemmatize("went")).toBe("go");
    expect(lemmatize("thought")).toBe("think");
  });

  it("strips regular -ed forms", () => {
    expect(lemmatize("walked")).toBe("walk");
    expect(lemmatize("stopped")).toBe("stop"); // doubled consonant
    expect(lemmatize("tried")).toBe("try"); // -ied → -y
  });

  it("leaves multi-word phrases untouched", () => {
    expect(lemmatize("burst row")).toBe("burst row");
  });

  it("leaves words with no matching rule untouched", () => {
    expect(lemmatize("harvest")).toBe("harvest");
  });

  it("returns an empty string unchanged", () => {
    expect(lemmatize("")).toBe("");
    expect(lemmatize("   ")).toBe("");
  });
});
