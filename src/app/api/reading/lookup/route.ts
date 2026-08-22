import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { findMatches } from "@/shared/lib/dedupe";
import { contextualTranslate } from "@/shared/lib/reading";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Translates a word tapped in the reading text, taking into account the
// sentence it appeared in. If the word already exists in the dictionary, we
// simply report that (without calling the AI) to avoid creating duplicates.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const word = String(body?.word ?? "").trim();
    const sentence = String(body?.sentence ?? "").trim();
    if (!word) return NextResponse.json({ error: "Empty word" }, { status: 400 });

    const words = await repo.listAll();
    const [existing] = findMatches(word, words);
    if (existing) {
      return NextResponse.json({ existing: { id: existing.id, word: existing.word, tr1: existing.tr1, status: existing.status } });
    }

    const t = await contextualTranslate(word, sentence);
    return NextResponse.json({ tr1: t.tr1, tr2: t.tr2 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to translate the word" }, { status: 500 });
  }
}
