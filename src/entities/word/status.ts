import type { SrsState } from "@/shared/lib/srs";
import { LEARNING_STEPS_MIN } from "@/shared/lib/srs";
import type { Word } from "./model";

// A word moves to "Изучен активно" (learned actively) only once both
// thresholds are cleared at once: enough successful active reps AND the
// required SRS interval reached. interval alone isn't enough — it stays 0 for
// all three same-day steps. reps alone isn't enough either — it can't tell
// "climbed the ladder over real days" apart from "clicked through reps back to back".
export function isActiveMature(active: SrsState, minReps: number, minInterval: number): boolean {
  return active.reps >= minReps && active.interval >= minInterval;
}

// How many words started on the passive track today. learnedAt is set
// exactly once, on the very first passive pass — a stable "started today"
// marker regardless of how many same-day steps (LEARNING_STEPS_MIN) the word went through in a day.
export function countLearnedPassiveToday(words: Pick<Word, "learnedAt">[], today: string): number {
  return words.filter((w) => w.learnedAt === today).length;
}

// The active track has no separate "start date" field, so we count as
// "started today" those words reviewed today whose reps are still within the
// same-day phase — a word that's been on the daily ladder for a while by now
// has a higher reps count and falls outside the range.
export function countLearnedActiveToday(words: Pick<Word, "active">[], today: string): number {
  return words.filter(
    (w) => w.active.last === today && w.active.reps >= 1 && w.active.reps <= LEARNING_STEPS_MIN.length + 1
  ).length;
}
