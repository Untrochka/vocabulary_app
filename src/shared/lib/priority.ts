import { todayISO } from "@/shared/lib/srs";

// Inputs the priority score needs — a subset of Word, not the whole thing, so
// this stays testable without constructing a full Word object every time.
export interface PriorityInput {
  frequency: number | null; // 1..100 from Groq grading, null until graded
  ieltsRelevant: boolean | null;
  correctStreak: number;
  batchId: string | null; // set if this word came from a PracticeBatch
  firstSeenAt: string | null; // YYYY-MM-DD
  debtSince: string | null; // YYYY-MM-DD, null = no debt
}

// A word with this many consecutive correct reviews is "almost learned" —
// worth finishing off rather than letting a fresh new word take its slot.
const ALMOST_LEARNED_STREAK = 2;

// How many days a practice-batch word keeps its priority boost, decaying
// linearly to 0 — the point of practice mode is drilling a fresh batch while
// the reading/listening context is still in memory, not forever after.
const PRACTICE_FRESH_DAYS = 7;

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00").getTime();
  const to = new Date(toISO + "T00:00:00").getTime();
  return Math.round((to - from) / 86400000);
}

function practiceFreshness(input: PriorityInput, today: string): number {
  if (!input.batchId || !input.firstSeenAt) return 0;
  const daysSince = daysBetween(input.firstSeenAt, today);
  return Math.max(0, 1 - daysSince / PRACTICE_FRESH_DAYS);
}

// priority = frequency×0.35 + ielts×15 + almostLearned×25 + practiceFresh×30 + debt×40,
// clamped to 0..100. Weighted so a real debt (a word actively being dodged)
// outranks everything else, and raw frequency alone can't push a word above
// roughly a third of the scale on its own.
export function computePriority(input: PriorityInput, today: string = todayISO()): number {
  const frequencyScore = (input.frequency ?? 0) * 0.35;
  const ieltsScore = input.ieltsRelevant ? 15 : 0;
  const almostLearnedScore = input.correctStreak >= ALMOST_LEARNED_STREAK ? 25 : 0;
  const practiceFreshScore = practiceFreshness(input, today) * 30;
  const debtScore = input.debtSince ? 40 : 0;
  const total = frequencyScore + ieltsScore + almostLearnedScore + practiceFreshScore + debtScore;
  return Math.max(0, Math.min(100, Math.round(total)));
}
