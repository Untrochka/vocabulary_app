import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { fetchTranslation } from "@/shared/lib/translate";
import { lemmatize } from "@/shared/lib/lemmatize";
import { parseEntry } from "@/shared/lib/parseEntry";
import { assessWordQuality } from "@/shared/lib/wordValidation";
import { gradeAndSaveWords } from "@/shared/lib/wordGrader";
import { createPracticeBatch } from "@/shared/lib/practice";
import { computePriority } from "@/shared/lib/priority";
import type { NewWordInput } from "@/entities/word/model";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // grading the newly-added words can take a few Groq round-trips

// List of all words — used for duplicate checking on the add screen (picking
// an existing word, highlighting matches within a batch) and for the /words
// browse screen (priority, status, debt — the replacement for eyeballing
// the dictionary in Notion, which the Postgres migration retired).
export async function GET() {
  try {
    const words = await repo.listAll();
    return NextResponse.json({
      words: words.map((w) => ({
        id: w.id, word: w.word, tr1: w.tr1, tr2: w.tr2, ipa: w.ipa, example: w.example,
        status: w.status, priority: w.priority, correctStreak: w.correctStreak,
        debtSince: w.debtSince, batchId: w.batchId, activeWorthy: w.activeWorthy,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load the word list" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let words: NewWordInput[] = [];
    // Indexes of entries for which auto-translate genuinely found nothing (as
    // opposed to being left empty on purpose by the caller, as in the entries[]
    // branch — there an empty translation is expected to be filled in later via /api/words/enrich).
    const autoTranslateFailed = new Set<number>();

    if (Array.isArray(body?.entries)) {
      words = body.entries
        .map((e: any) => ({ word: String(e.word ?? "").trim(), tr1: e.tr1, tr2: e.tr2, ipa: e.ipa, example: e.example }))
        .filter((e: NewWordInput) => e.word);
    } else if (typeof body?.text === "string") {
      const raw = body.text.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
      words = [];
      for (const line of raw) {
        const { word, pos } = parseEntry(line);
        // lemmatize() is only used to find the translation/IPA in the dictionary
        // (it usually lacks word forms like "enduring"). We keep the form the
        // user actually typed, not the dictionary base form — otherwise the
        // card wouldn't match the word actually encountered in the text.
        const t = await fetchTranslation(lemmatize(word), { pos });
        if (!t) autoTranslateFailed.add(words.length);
        words.push({ word, tr1: t?.tr1, tr2: t?.tr2, ipa: t?.ipa, example: t?.example });
      }
    } else if (body?.word) {
      const { word, pos } = parseEntry(String(body.word).trim());
      let entry: NewWordInput = { word, tr1: body.tr1, tr2: body.tr2, ipa: body.ipa, example: body.example };
      // Single words are also auto-translated if no translation came from the form.
      if (!entry.tr1) {
        const t = await fetchTranslation(lemmatize(word), { pos: pos ?? body.pos });
        if (!t) autoTranslateFailed.add(0);
        entry = {
          word,
          tr1: entry.tr1 ?? t?.tr1,
          tr2: entry.tr2 ?? t?.tr2,
          ipa: entry.ipa ?? t?.ipa,
          example: entry.example ?? t?.example,
        };
      }
      words = [entry];
    }

    const skipped: { word: string; reason: string }[] = [];
    const clean: NewWordInput[] = [];
    words.forEach((w, idx) => {
      const q = assessWordQuality(w.word);
      if (!q.ok) { skipped.push({ word: w.word, reason: q.reason ?? "gibberish" }); return; }
      if (autoTranslateFailed.has(idx)) { skipped.push({ word: w.word, reason: "translation not found — looks like a recognition error" }); return; }
      clean.push(w);
    });

    if (!clean.length) return NextResponse.json({ error: "No words to add", skipped }, { status: 400 });

    // A practice batch (reading/listening word dump) — batchSource is a free
    // text label, e.g. "reading: an article about coral reefs". Presence of
    // the field (even empty string) is what marks this a practice add;
    // absence just means a regular add, no batch created.
    const batchId = typeof body?.batchSource === "string" ? await createPracticeBatch(body.batchSource) : undefined;

    const createdWords = await repo.create(clean, batchId);

    // A real initial priority right away, independent of grading — a
    // practice batch's freshness boost (priority.ts) doesn't depend on
    // frequency/ieltsRelevant at all, so it shouldn't wait on Groq to apply.
    // gradeAndSaveWords below overwrites this with a better-informed value
    // once frequency/ieltsRelevant are known — if grading fails or GROQ_API_KEY
    // isn't set, the freshness boost still took effect.
    await Promise.all(
      createdWords.map((w) =>
        repo.update(w.id, {
          priority: computePriority({
            frequency: w.frequency,
            ieltsRelevant: w.ieltsRelevant,
            correctStreak: w.correctStreak,
            batchId: w.batchId,
            firstSeenAt: w.firstSeenAt,
            debtSince: w.debtSince,
          }),
        })
      )
    );

    // Best-effort — grading is a nice-to-have that shouldn't turn a
    // successful add into an error. Without GROQ_API_KEY this just fails
    // fast and the words stay ungraded until the next /api/words/grade pass.
    try {
      await gradeAndSaveWords(createdWords);
    } catch (e) {
      console.error("wordGrader: grading newly-added words failed", e);
    }

    return NextResponse.json({ created: createdWords.length, skipped });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to add" }, { status: 500 });
  }
}
