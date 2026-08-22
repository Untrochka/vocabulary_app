// Structural gibberish check when adding words — no dictionary lookup, just
// shape: guards against broken speech-to-text like "fel", "attle", or "put
// your fit in it", without touching legitimate rare words and phrases (for
// those, a translation simply won't be found — that's fine, not gibberish).

const VOWELS = /[aeiouy]/i;
const REPEATED_CHAR = /(.)\1{3,}/; // 4+ identical characters in a row

export interface WordQuality {
  ok: boolean;
  reason?: string;
}

export function assessWordQuality(raw: string): WordQuality {
  const word = raw.trim();
  if (!word) return { ok: false, reason: "empty" };
  if (!/^[a-zA-Z][a-zA-Z\s'-]*$/.test(word)) return { ok: false, reason: "not Latin script" };
  if (word.length < 2) return { ok: false, reason: "too short" };
  if (!VOWELS.test(word)) return { ok: false, reason: "no vowels" };
  if (REPEATED_CHAR.test(word)) return { ok: false, reason: "repeated characters" };
  const wordCount = word.split(/\s+/).filter(Boolean).length;
  if (wordCount > 5) return { ok: false, reason: "looks like a phrase fragment, not a word" };
  return { ok: true };
}
