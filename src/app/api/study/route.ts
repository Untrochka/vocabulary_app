import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { review, strength, todayISO, type Grade } from "@/shared/lib/srs";
import { CAPS, STATUS } from "@/shared/config/app";
import type { Word } from "@/entities/word/model";
import { isActiveMature } from "@/entities/word/status";
import { computePriority } from "@/shared/lib/priority";
import { recordActivity, type ActivityKind } from "@/shared/lib/streaks";
import { maybeCompletePracticeBatch } from "@/shared/lib/practice";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, action, mode, grade } = body as {
      id: string; action: "learn" | "review"; mode?: "passive" | "active"; grade?: Grade;
    };
    const w = await repo.get(id);
    if (!w) return NextResponse.json({ error: "Word not found" }, { status: 404 });

    const fields: Partial<Word> = {};
    let activityKind: ActivityKind;
    const today = todayISO();

    // Debt: a grade-0 ("Again") review — passive or active — means the word
    // genuinely wasn't recalled. It stays in debt (blocks new words from
    // filling the daily cap and gets reviewed first — see session.ts /
    // studyQueue.ts) until it's answered correctly on some later review,
    // on either track — that's "resolved," not "resolved specifically on
    // the track that failed."
    let debtSince = w.debtSince;
    function applyDebt(g: Grade) {
      debtSince = g === 0 ? (debtSince ?? today) : null;
    }

    // correctStreak/lapses track the ACTIVE track specifically — that's what
    // isActiveMature reads. They stay untouched by "learn" and passive
    // reviews on purpose: mastery here means "can produce it," not "can
    // recognize it," so only active outcomes should move that needle.
    let correctStreak = w.correctStreak;
    let lapses = w.lapses;

    if (action === "learn") {
      const g = grade ?? 2;
      const passive = review(w.passive, g);
      fields.passive = passive;
      fields.learnedAt = w.learnedAt ?? today;
      if (w.status === STATUS.new) fields.status = STATUS.passive;
      fields.strength = Math.max(strength(passive), strength(w.active));
      applyDebt(g);
      activityKind = "new";
    } else if (action === "review" && mode === "passive" && grade !== undefined) {
      const passive = review(w.passive, grade);
      fields.passive = passive;
      fields.strength = Math.max(strength(passive), strength(w.active));
      applyDebt(grade);
      activityKind = "passive";
    } else if (action === "review" && mode === "active" && grade !== undefined) {
      const active = review(w.active, grade);
      fields.active = active;
      // Active grades only ever reach here as exactly 0 (typed wrong — see
      // ActiveBody's onResult(0) path) or 1-3 (typed right, self-rated
      // Hard/Good/Easy) — the UI never lets a mistyped answer reach the
      // grading buttons. So grade === 0 is the one real signal of a miss.
      if (grade === 0) {
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
      applyDebt(grade);
      activityKind = "active";
    } else {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
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

    await repo.update(id, fields);

    // Streak is a secondary metric in a separate DB: a failure here shouldn't
    // turn an already-saved answer into an error for the user.
    try {
      await recordActivity(activityKind);
    } catch (e) {
      console.error("streak: recordActivity failed", e);
    }

    // "learn" is the only action that ever takes a word past its first
    // passive pass (review()/isDue() both require reps > 0 already, so a
    // word can only reach action:"review" once it's already past this
    // point) — the one moment a practice batch could just have finished.
    if (action === "learn" && w.batchId) {
      try {
        await maybeCompletePracticeBatch(w.batchId);
      } catch (e) {
        console.error("practice: maybeCompletePracticeBatch failed", e);
      }
    }

    return NextResponse.json({ ok: true, strength: fields.strength });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
