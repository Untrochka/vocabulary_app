import { NextResponse } from "next/server";
import { fetchTranslation } from "@/shared/lib/translate";
import { lemmatize } from "@/shared/lib/lemmatize";
import { parseEntry } from "@/shared/lib/parseEntry";

export const dynamic = "force-dynamic";

// Live translation of a single word for the add form.
// Returns the translation, part of speech, IPA, example, and all groups by
// part of speech (byPos) — so the UI can show a part-of-speech picker without another request.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("word") ?? "").trim();
  if (!raw) return NextResponse.json({ error: "Empty word" }, { status: 400 });

  const { word, pos } = parseEntry(raw);
  const base = lemmatize(word);
  const t = await fetchTranslation(base, { pos: pos ?? searchParams.get("pos") ?? undefined });
  if (!t) return NextResponse.json({ error: "Translation not found" }, { status: 404 });

  return NextResponse.json({ word: base, ...t });
}
