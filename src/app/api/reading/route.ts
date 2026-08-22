import { NextResponse } from "next/server";
import { getSessionSummary } from "@/shared/lib/session";
import { pickReadingWords, generateStory } from "@/shared/lib/reading";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // story generation can take longer than the default 10s

export async function GET() {
  try {
    const session = await getSessionSummary();
    const words = pickReadingWords(session);
    if (words.length === 0) {
      return NextResponse.json(
        { error: "There are no words for today's reading — learn or add at least one word first." },
        { status: 400 }
      );
    }
    const story = await generateStory(words);
    return NextResponse.json({ story, words });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to generate the story" }, { status: 500 });
  }
}
