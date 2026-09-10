import { LEARNING_STEPS_MIN } from "@/shared/lib/srs";
import type { Word } from "./model";

// A word moves to "Изучен активно" (learned actively) only once both
// thresholds are cleared at once: enough CONSECUTIVE correct active reviews
// (correctStreak — resets to 0 on any miss, unlike a plain rep count, which
// used to let a handful of near-misses still count toward mastery) AND the
// required SRS interval reached. Streak alone isn't enough — a word answered
// right three times in a row same-day hasn't proven it survives real days
// apart; interval alone isn't enough either — it stays 0 for all the
// same-day steps regardless of how many were answered correctly.
export function isActiveMature(correctStreak: number, activeInterval: number, minStreak: number, minInterval: number): boolean {
  return correctStreak >= minStreak && activeInterval >= minInterval;
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
