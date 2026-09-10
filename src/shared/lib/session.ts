import { repo } from "@/shared/lib/repository";
import { todayISO, isDue } from "@/shared/lib/srs";
import { CAPS, STATUS } from "@/shared/config/app";
import type { Word } from "@/entities/word/model";
import { countLearnedActiveToday, countLearnedPassiveToday } from "@/entities/word/status";
import type { SessionCard, SessionResponse } from "@/entities/session/model";

// Single source of truth for today's queue count — used by both /api/session
// (for the screen) and the morning/evening Telegram cron notification. The
// numbers must match: the bot can't promise one thing while the app shows another.
const card = (w: Word): SessionCard => ({
  id: w.id, word: w.word, tr1: w.tr1, tr2: w.tr2, ipa: w.ipa, example: w.example, strength: w.strength,
  passive: w.passive, active: w.active,
  isDebt: w.debtSince !== null,
});

const byPriorityDesc = (a: Word, b: Word) => b.priority - a.priority;

// Picks today's new-word list from every eligible candidate. Split out as
// its own pure function (not inlined in getSessionSummary) after a real bug:
// an earlier version just sorted everyone by priority and sliced, which let
// an already-graded, high-frequency regular word bump a freshly-added
// practice-batch word out of today's list entirely, even though there was
// room for it. Batch words are placed first, unconditionally, and the cap
// itself is raised to fit them if the batch is bigger than the usual daily
// allowance — "more important than the regular 8" means guaranteed a slot,
// not just "priority-sorted along with everyone else."
export function pickNewToLearn(
  eligible: Word[],
  dailyCap: number,
  debtCount: number
): Word[] {
  const batchCandidates = eligible.filter((w) => w.batchId !== null).sort(byPriorityDesc);
  const regularCandidates = eligible.filter((w) => w.batchId === null).sort(byPriorityDesc);

  const capToday = Math.max(Math.max(0, dailyCap - debtCount), batchCandidates.length);

  return [...batchCandidates, ...regularCandidates].slice(0, capToday);
}

export async function getSessionSummary(): Promise<SessionResponse> {
  const words = await repo.listAll();
  const today = todayISO();
  const now = new Date();

  const learnedPassiveToday = countLearnedPassiveToday(words, today);
  const learnedActiveToday = countLearnedActiveToday(words, today);

  const debtCount = words.filter((w) => w.debtSince !== null).length;

  const newEligible = words.filter((w) => w.status === STATUS.new && w.passive.reps === 0 && !!w.tr1);

  // Debt eats into today's new-passive-word budget before anything else gets
  // a slot — 5 unresolved words out of a cap of 8 leaves room for 3 new
  // ones, not 8. Self-regulating: a debt pile bigger than the cap just
  // brings today's new-word count to 0, it doesn't go negative. Doesn't
  // touch the active cap — debt is fundamentally a "you haven't recalled
  // this yet" problem, closer to passive recognition than active production.
  // A practice batch (see pickNewToLearn) overrides the debt-shrunk cap, not
  // the other way around — a fresh batch should clear same-day regardless of
  // pre-existing debt.
  const newToLearn = pickNewToLearn(newEligible, CAPS.passivePerDay - learnedPassiveToday, debtCount).map(card);

  const duePassive = words.filter((w) => isDue(w.passive, now)).map(card);

  // Only words Groq has actually flagged as worth active production enter
  // this track. An ungraded word (activeWorthy still null — grading hasn't
  // run yet) waits here rather than defaulting to "promote it anyway", which
  // is the exact mechanical-promotion behavior this whole system replaces.
  const activeEligible = words.filter(
    (w) =>
      w.activeWorthy === true &&
      (w.status === STATUS.passive || w.status === STATUS.pickedActive || w.status === STATUS.active) &&
      w.learnedAt !== today
  );
  const dueActive = activeEligible.filter((w) => isDue(w.active, now)).map(card);
  const newActive = activeEligible
    .filter((w) => w.active.reps === 0)
    .sort(byPriorityDesc)
    .slice(0, Math.max(0, CAPS.activePerDay - learnedActiveToday))
    .map(card);

  const counts = {
    total: words.length,
    mastered: words.filter((w) => w.status === STATUS.active).length,
    learning: words.filter((w) => w.status === STATUS.passive || w.status === STATUS.pickedActive).length,
  };

  const laterTodayDue = [...words.flatMap((w) => [w.passive, w.active])]
    .filter((s) => s.due && new Date(s.due).getTime() > now.getTime() && todayISO(new Date(s.due)) === today)
    .map((s) => s.due as string)
    .sort();

  return {
    newToLearn, duePassive, dueActive, newActive, counts,
    caps: CAPS,
    today: { passive: learnedPassiveToday, active: learnedActiveToday },
    laterToday: { count: laterTodayDue.length, nextAt: laterTodayDue[0] ?? null },
    debtCount,
  };
}
