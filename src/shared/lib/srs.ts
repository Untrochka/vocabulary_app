// SM-2 algorithm (like Anki's). Pure functions, no dependencies.

export interface SrsState {
  reps: number;
  interval: number; // days
  ease: number; // ease factor
  due: string | null; // ISO date (YYYY-MM-DD) or full date-time
  last: string | null; // ISO date or date-time
}

export type Grade = 0 | 1 | 2 | 3; // Again, Hard, Good, Easy

export const EMPTY_SRS: SrsState = { reps: 0, interval: 0, ease: 2.5, due: null, last: null };

// "Almost right away" if the word wasn't recalled at all — a short retry
// window instead of a vague "later today".
const LAPSE_MINUTES = 20;

// Same-day steps before a word first moves onto the daily schedule.
// Previously the first successful answer immediately set due to "tomorrow" —
// so a word easily recalled in the morning would already be forgotten by
// evening without a single same-day review.
export const LEARNING_STEPS_MIN = [20, 180, 480]; // 20 min, 3 hours, 8 hours

// The first stretch for a fully learned word — a fixed grid instead of
// ease-dependent growth, so review days are predictable (1 → 3 → 7 → 14).
// After that, growth continues as before, driven by ease.
export const FIXED_DAYS = [1, 3, 7, 14];

export function todayISO(d = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

function addMinutes(from: Date, minutes: number): string {
  return new Date(from.getTime() + minutes * 60000).toISOString();
}

// Works both with old dates without a time part (parsed as midnight) and with
// new date-times — no special data migration is needed.
export function isDue(state: SrsState, now = new Date()): boolean {
  return state.reps > 0 && !!state.due && new Date(state.due).getTime() <= now.getTime();
}

const QUALITY: Record<Grade, number> = { 0: 1, 1: 3, 2: 4, 3: 5 };
// A small difference in the interval itself between Hard/Good/Easy
// (previously all three gave nearly the same next interval — only the future ease differed).
const GRADE_MULT: Record<Grade, number> = { 0: 1, 1: 0.8, 2: 1, 3: 1.3 };

export function review(state: SrsState, grade: Grade): SrsState {
  const now = new Date();
  const today = todayISO(now);
  const q = QUALITY[grade];
  let { reps, interval, ease } = { ...state };

  if (q < 3) {
    return { reps: 0, interval: 0, ease: Math.max(1.3, ease - 0.2), due: addMinutes(now, LAPSE_MINUTES), last: today };
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  // Not all same-day steps have been completed yet — the next review is
  // later the same day, not "tomorrow". reps here counts completed steps (1, 2, 3…).
  if (reps < LEARNING_STEPS_MIN.length) {
    const due = addMinutes(now, LEARNING_STEPS_MIN[reps]);
    return { reps: reps + 1, interval: 0, ease, due, last: today };
  }

  // Same-day steps are complete — fixed grid of 1 → 3 → 7 → 14 days,
  // then regular ease-driven growth.
  const gradIdx = reps - LEARNING_STEPS_MIN.length;
  interval = gradIdx < FIXED_DAYS.length
    ? FIXED_DAYS[gradIdx]
    : Math.max(1, Math.round(interval * ease * GRADE_MULT[grade]));
  reps += 1;
  return { reps, interval, ease, due: addDays(today, interval), last: today };
}

export function strength(state: SrsState): number {
  if (state.reps === 0) return 0;
  return Math.min(100, Math.round((Math.min(state.interval, 30) / 30) * 100));
}

// Real interval preview for the grade buttons — computes the actual result
// of review(), not a static table.
export function nextIntervalLabel(state: SrsState, grade: Grade): string {
  const result = review(state, grade);
  if (result.interval === 0 && result.due) {
    const mins = Math.max(1, Math.round((new Date(result.due).getTime() - Date.now()) / 60000));
    if (mins < 60) return `${mins} min`;
    return `${Math.round(mins / 60)} h`;
  }
  const d = result.interval;
  if (d <= 1) return "1 day";
  if (d < 5) return `${d} days`;
  if (d < 21) return `${Math.max(1, Math.round(d / 7))} wk`;
  return `${Math.max(1, Math.round(d / 30))} mo`;
}

// "Time until" an arbitrary due date — for the home screen summary
// ("later today: 5 words, next in 40 min"), not just for the grade buttons.
export function formatDueIn(due: string, now = new Date()): string {
  const mins = Math.max(0, Math.round((new Date(due).getTime() - now.getTime()) / 60000));
  if (mins < 1) return "due now";
  if (mins < 60) return `${mins} min`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)} h`;
  return `${Math.round(hrs / 24)} d`;
}
