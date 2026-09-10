import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { gradeAndSaveWords } from "@/shared/lib/wordGrader";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // several Groq batches in sequence — slower than a single call

// Grades every word that hasn't been graded yet (gradedAt is null) — the
// one-time full pass over the existing list, and the ongoing "grade it once
// when it's added" case both go through this same endpoint. Pass
// { force: true } to re-grade words that already have a grade (e.g. after
// changing the grading prompt). Idempotent either way — safe to re-run if it
// times out partway through, already-graded words are simply skipped next time.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const force = Boolean(body?.force);

    const all = await repo.listAll();
    const toGrade = force ? all : all.filter((w) => !w.gradedAt);

    if (toGrade.length === 0) {
      return NextResponse.json({ gradedCount: 0, unmatched: [], batchCount: 0, alreadyGraded: all.length });
    }

    const result = await gradeAndSaveWords(toGrade);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to grade words" }, { status: 500 });
  }
}
