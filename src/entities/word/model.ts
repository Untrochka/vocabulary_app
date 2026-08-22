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
}

export interface NewWordInput {
  word: string;
  tr1?: string;
  tr2?: string;
  ipa?: string;
  example?: string;
}
