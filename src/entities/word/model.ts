import type { SrsState } from "@/shared/lib/srs";

export type WordStatus =
  | "Не изучен"
  | "Выбран для активного изучения"
  | "Изучен пассивно"
  | "Изучен активно";

export interface Word {
  id: string;
  word: string; // word or phrase
  tr1: string;
  tr2: string;
  ipa: string;
  example: string;
  status: WordStatus;
  strength: number; // 0..100
  learnedAt: string | null;
  passive: SrsState; // recognition track
  active: SrsState; // production track

  // Priority system — see shared/lib/priority.ts for the scoring formula and
  // shared/lib/wordGrader.ts for how frequency/ieltsRelevant/activeWorthy get set.
  priority: number; // 0..100, recomputed by the priority formula
  frequency: number | null; // Groq's 1..100 estimate of how common this word is
  ieltsRelevant: boolean | null;
  activeWorthy: boolean | null; // only activeWorthy words are eligible for the active track
  gradeReason: string | null; // one line of why, from the Groq grading call
  gradedAt: string | null; // ISO date-time, null until graded

  correctStreak: number; // consecutive correct reviews — the real "mastered" signal
  lapses: number; // total times this word has been gotten wrong
  debtSince: string | null; // YYYY-MM-DD this word first went unresolved; null = no debt
  firstSeenAt: string | null; // YYYY-MM-DD of the first time this word was shown
  batchId: string | null; // links to a PracticeBatch, if added from one
}

export interface NewWordInput {
  word: string;
  tr1?: string;
  tr2?: string;
  ipa?: string;
  example?: string;
}
