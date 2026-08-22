// Parses a list line like "word (noun)" → { word: "word", pos: "noun" }.
// The part of speech in parentheses is optional: "word" → { word: "word" }.
export function parseEntry(raw: string): { word: string; pos?: string } {
  const m = raw.trim().match(/^(.*?)\s*[([]([^)\]]+)[)\]]\s*$/);
  if (m && m[1].trim()) return { word: m[1].trim(), pos: m[2].trim() };
  return { word: raw.trim() };
}
