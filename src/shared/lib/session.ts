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
});

export async function getSessionSummary(): Promise<SessionResponse> {
  const words = await repo.listAll();
  const today = todayISO();
  const now = new Date();

  const learnedPassiveToday = countLearnedPassiveToday(words, today);
  const learnedActiveToday = countLearnedActiveToday(words, today);

  const newToLearn = words
    .filter((w) => w.status === STATUS.new && w.passive.reps === 0 && !!w.tr1)
    .slice(0, Math.max(0, CAPS.passivePerDay - learnedPassiveToday))
    .map(card);

  const duePassive = words.filter((w) => isDue(w.passive, now)).map(card);

  const activeEligible = words.filter(
    (w) =>
      (w.status === STATUS.passive || w.status === STATUS.pickedActive || w.status === STATUS.active) &&
      w.learnedAt !== today
  );
  const dueActive = activeEligible.filter((w) => isDue(w.active, now)).map(card);
  const newActive = activeEligible
    .filter((w) => w.active.reps === 0)
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
  };
}
