import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import type { Grade } from "@/shared/lib/srs";
import { computeReviewOutcome, type ReviewAction } from "@/shared/lib/reviewOutcome";
import { recordActivity } from "@/shared/lib/streaks";
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

    let reviewAction: ReviewAction;
    if (action === "learn") {
      reviewAction = { kind: "learn", grade: grade ?? 2 };
    } else if (action === "review" && mode === "passive" && grade !== undefined) {
      reviewAction = { kind: "review", mode: "passive", grade };
    } else if (action === "review" && mode === "active" && grade !== undefined) {
      reviewAction = { kind: "review", mode: "active", grade };
    } else {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const { fields, activityKind } = computeReviewOutcome(w, reviewAction);
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
