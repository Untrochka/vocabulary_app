import { lemmatize } from "@/shared/lib/lemmatize";

// Normalization for comparison: case doesn't matter, base form via the same
// lemmatize() the backend uses when saving — "cats" should find an already-added "cat".
export function normalizeWord(word: string): string {
  return lemmatize(word.trim().toLowerCase());
}

export interface MatchCandidate {
  id: string;
  word: string;
}

// Finds already-existing words matching the entered one (after normalization).
export function findMatches<T extends MatchCandidate>(word: string, existing: T[]): T[] {
  const needle = normalizeWord(word);
  if (!needle) return [];
  return existing.filter((w) => normalizeWord(w.word) === needle);
}
