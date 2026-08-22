import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { fetchTranslation } from "@/shared/lib/translate";
import { lemmatize } from "@/shared/lib/lemmatize";
import { parseEntry } from "@/shared/lib/parseEntry";
import { assessWordQuality } from "@/shared/lib/wordValidation";
import type { NewWordInput } from "@/entities/word/model";

export const dynamic = "force-dynamic";

// Lightweight list of all words — for duplicate checking on the add screen
// (picking an existing word, highlighting matches within a batch).
export async function GET() {
  try {
    const words = await repo.listAll();
    return NextResponse.json({
      words: words.map((w) => ({ id: w.id, word: w.word, tr1: w.tr1, tr2: w.tr2, ipa: w.ipa, example: w.example })),
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

    const created = await repo.create(clean);
    return NextResponse.json({ created, skipped });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to add" }, { status: 500 });
  }
}
