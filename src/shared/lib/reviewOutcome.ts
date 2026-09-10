import { review, strength, todayISO, type Grade } from "@/shared/lib/srs";
import { CAPS, STATUS } from "@/shared/config/app";
import { isActiveMature } from "@/entities/word/status";
import { computePriority } from "@/shared/lib/priority";
import type { Word } from "@/entities/word/model";
import type { ActivityKind } from "@/shared/lib/streaks";

export type ReviewAction =
  | { kind: "learn"; grade: Grade }
  | { kind: "review"; mode: "passive" | "active"; grade: Grade };

export interface ReviewOutcome {
  fields: Partial<Word>;
  activityKind: ActivityKind;
}

// Computes every field update a review outcome produces — SRS state, debt,
// the active-track mastery streak, and a recomputed priority — as one pure
// function, shared between /api/study (the normal lesson flow) and
// /api/recall (the evening self-explanation check, which also grades as an
// active review — see recall.ts). Previously this lived only inside
// study/route.ts; recall needed the exact same rules, and duplicating debt/
// streak/priority logic across two routes is exactly the kind of thing that
// quietly drifts out of sync.
export function computeReviewOutcome(w: Word, action: ReviewAction): ReviewOutcome {
  const fields: Partial<Word> = {};
  const today = todayISO();

  // Debt: a grade-0 ("Again") review — passive or active — means the word
  // genuinely wasn't recalled. It stays in debt (blocks new words from
  // filling the daily cap and gets reviewed first — see session.ts /
  // studyQueue.ts) until it's answered correctly on some later review, on
  // either track — that's "resolved," not "resolved specifically on the
  // track that failed."
  let debtSince = w.debtSince;
  const applyDebt = (g: Grade) => {
    debtSince = g === 0 ? (debtSince ?? today) : null;
  };

  // correctStreak/lapses track the ACTIVE track specifically — that's what
  // isActiveMature reads. They stay untouched by "learn" and passive
  // reviews on purpose: mastery here means "can produce it," not "can
  // recognize it," so only active outcomes should move that needle.
  let correctStreak = w.correctStreak;
  let lapses = w.lapses;
  let activityKind: ActivityKind;

  if (action.kind === "learn") {
    const passive = review(w.passive, action.grade);
    fields.passive = passive;
    fields.learnedAt = w.learnedAt ?? today;
    if (w.status === STATUS.new) fields.status = STATUS.passive;
    fields.strength = Math.max(strength(passive), strength(w.active));
    applyDebt(action.grade);
    activityKind = "new";
  } else if (action.mode === "passive") {
    const passive = review(w.passive, action.grade);
    fields.passive = passive;
    fields.strength = Math.max(strength(passive), strength(w.active));
    applyDebt(action.grade);
    activityKind = "passive";
  } else {
    const wasFirstActiveReview = w.active.reps === 0;
    const active = review(w.active, action.grade);
    fields.active = active;
    if (wasFirstActiveReview && !w.firstActiveAt) fields.firstActiveAt = today;
    // Active grades only ever reach here as exactly 0 (typed wrong — see
    // ActiveBody's onResult(0) path, and the "wrong" recall verdict, which
    // maps to the same grade) or 1-3 (typed right, self-rated Hard/Good/Easy,
    // or recall's correct/partial verdicts) — never a mistyped answer with a
    // self-assessed grade. So grade === 0 is the one real signal of a miss.
    if (action.grade === 0) {
      correctStreak = 0;
      lapses += 1;
    } else {
      correctStreak += 1;
    }
    fields.status = isActiveMature(correctStreak, active.interval, CAPS.activeMatureStreak, CAPS.activeMatureDays)
      ? STATUS.active
      : STATUS.pickedActive;
    if (!w.learnedAt) fields.learnedAt = today;
    fields.strength = Math.max(strength(w.passive), strength(active));
    applyDebt(action.grade);
    activityKind = "active";
  }

  fields.correctStreak = correctStreak;
  fields.lapses = lapses;
  fields.debtSince = debtSince;
  fields.priority = computePriority({
    frequency: w.frequency,
    ieltsRelevant: w.ieltsRelevant,
    correctStreak,
    batchId: w.batchId,
    firstSeenAt: w.firstSeenAt,
    debtSince,
  });

  return { fields, activityKind };
}
