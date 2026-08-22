import { prisma } from "@/shared/lib/prisma";
import { addDays, todayISO } from "@/shared/lib/srs";

// Streaks live in the app's own DB, not in Notion — see schema.prisma.
// Daily minimum: at least one active review OR one new word. A plain
// passive review doesn't count toward the minimum — that's how the user decided it when this feature was planned.
export type ActivityKind = "new" | "active" | "passive";

export interface StreakSummary {
  current: number;
  best: number;
  status: "active" | "atRisk" | "broken" | "none";
  week: { date: string; met: boolean }[]; // last 7 days, oldest to today
}

// Pure function — doesn't touch the DB, so it's easy to test separately from recordActivity.
export function computeStreakDisplay(
  state: { current: number; best: number; lastActiveDate: string | null },
  today: string,
): Omit<StreakSummary, "week"> {
  if (!state.lastActiveDate) return { current: 0, best: state.best, status: "none" };
  if (state.lastActiveDate === today) return { current: state.current, best: state.best, status: "active" };
  const yesterday = addDays(today, -1);
  if (state.lastActiveDate === yesterday) return { current: state.current, best: state.best, status: "atRisk" };
  // Streak broke — we show this honestly but without guilt-tripping: the
  // current streak is 0, a new one starts today if the minimum is met.
  return { current: 0, best: state.best, status: "broken" };
}

export async function getStreakSummary(): Promise<StreakSummary> {
  const today = todayISO();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)); // 6 days ago … today

  const [state, rows] = await Promise.all([
    prisma.streakState.findUnique({ where: { id: 1 } }),
    prisma.dailyActivity.findMany({ where: { date: { in: dates } }, select: { date: true, minimumMet: true } }),
  ]);

  const metByDate = new Map(rows.map((r) => [r.date, r.minimumMet]));
  const week = dates.map((date) => ({ date, met: metByDate.get(date) ?? false }));

  if (!state) return { current: 0, best: 0, status: "none", week };
  return { ...computeStreakDisplay(state, today), week };
}

// Records a completed action in daily activity and, if today's minimum was
// just met for the first time today, extends or starts the streak. Errors
// here are intentionally not allowed to break /api/study — the word's
// progress is already saved in Notion, and the streak is a secondary metric.
export async function recordActivity(kind: ActivityKind): Promise<void> {
  const today = todayISO();
  const inc = {
    activeReviews: kind === "active" ? 1 : 0,
    passiveReviews: kind === "passive" ? 1 : 0,
    newWords: kind === "new" ? 1 : 0,
  };

  const day = await prisma.dailyActivity.upsert({
    where: { date: today },
    create: { date: today, ...inc },
    update: {
      activeReviews: { increment: inc.activeReviews },
      passiveReviews: { increment: inc.passiveReviews },
      newWords: { increment: inc.newWords },
    },
  });

  const minimumMet = day.activeReviews > 0 || day.newWords > 0;
  if (!minimumMet || day.minimumMet) return;

  await prisma.dailyActivity.update({ where: { date: today }, data: { minimumMet: true } });

  const state = await prisma.streakState.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  if (state.lastActiveDate === today) return; // just in case — avoid double-counting

  const yesterday = addDays(today, -1);
  const continuing = state.lastActiveDate === yesterday;
  const current = continuing ? state.current + 1 : 1;
  const best = Math.max(state.best, current);
  await prisma.streakState.update({ where: { id: 1 }, data: { current, best, lastActiveDate: today } });
}
