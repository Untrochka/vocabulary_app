import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { prisma } from "@/shared/lib/prisma";
import { pickRecallWords, judgeRecallGuess, RECALL_GRADE } from "@/shared/lib/recall";
import { computeReviewOutcome } from "@/shared/lib/reviewOutcome";
import { recordActivity } from "@/shared/lib/streaks";
import { todayISO } from "@/shared/lib/srs";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Words that became active on the given day (defaults to today), plus
// whatever guess already exists for each on that day — so revisiting the
// page shows what was already answered instead of a blank slate. The
// target word itself is only included once a word has been answered
// (revealing it is fine after the fact, but never before the guess).
export async function GET(req: Request) {
  try {
    const day = new URL(req.url).searchParams.get("day") || todayISO();
    const words = await repo.listAll();
    const recallWords = pickRecallWords(words, day);
    const byId = new Map(words.map((w) => [w.id, w]));

    const explanations = await prisma.selfExplanation.findMany({
      where: { forDate: day, wordId: { in: recallWords.map((w) => w.id) } },
      orderBy: { createdAt: "desc" },
    });
    // A word can be answered more than once (revising an earlier attempt) —
    // desc order + "first occurrence wins" keeps only the most recent one.
    const byWordId = new Map<string, (typeof explanations)[number]>();
    for (const e of explanations) if (!byWordId.has(e.wordId)) byWordId.set(e.wordId, e);

    return NextResponse.json({
      day,
      words: recallWords.map((w) => {
        const e = byWordId.get(w.id);
        return {
          ...w,
          word: e ? byId.get(w.id)?.word ?? null : null,
          explanation: e ? { text: e.text, verdict: e.verdict, feedback: e.feedback } : null,
        };
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load recall words" }, { status: 500 });
  }
}

// Judges a recalled-from-memory guess and feeds the verdict back into the
// active track as a review — correct/partial/wrong map to the same
// Easy/Good/Again grades the normal study flow uses (see recall.ts). Reveals
// the target word in the response either way, since the check is now done.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const wordId = String(body?.wordId ?? "");
    const forDate = String(body?.forDate ?? "");
    const text = String(body?.text ?? "").trim();
    if (!wordId || !forDate) {
      return NextResponse.json({ error: "wordId and forDate are required" }, { status: 400 });
    }

    const w = await repo.get(wordId);
    if (!w) return NextResponse.json({ error: "Word not found" }, { status: 404 });

    // An empty guess ("I don't remember") skips the Groq call and is
    // always wrong — there's nothing to judge.
    const { verdict, feedback } = text
      ? await judgeRecallGuess(w.word, w.tr1, text)
      : { verdict: "wrong" as const, feedback: "Пропущено — слово не вспомнилось." };

    await prisma.selfExplanation.create({ data: { wordId, forDate, text, verdict, feedback } });

    const { fields, activityKind } = computeReviewOutcome(w, { kind: "review", mode: "active", grade: RECALL_GRADE[verdict] });
    await repo.update(wordId, fields);
    // Streak is a secondary metric in a separate DB: a failure here
    // shouldn't turn an already-judged, already-saved answer into an error.
    try {
      await recordActivity(activityKind);
    } catch (e) {
      console.error("streak: recordActivity failed", e);
    }

    return NextResponse.json({ verdict, feedback, word: w.word });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to judge the answer" }, { status: 500 });
  }
}
