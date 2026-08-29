import { NextResponse } from "next/server";
import { getSessionSummary } from "@/shared/lib/session";
import { repo } from "@/shared/lib/repository";
import { pickReadingWords, pickReadingWordsForDay, generateStory } from "@/shared/lib/reading";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // story generation can take longer than the default 10s

// No ?day param: today's live session (due reviews + new words) — the
// original default. With ?day=YYYY-MM-DD: every word learned on that date,
// regardless of today's due-state — see the comment on pickReadingWordsForDay.
export async function GET(req: Request) {
  try {
    const day = new URL(req.url).searchParams.get("day");

    const words = day
      ? pickReadingWordsForDay(await repo.listAll(), day)
      : pickReadingWords(await getSessionSummary());

    if (words.length === 0) {
      return NextResponse.json(
        {
          error: day
            ? "No words with a translation were learned on that day."
            : "There are no words for today's reading — learn or add at least one word first.",
        },
        { status: 400 }
      );
    }
    const story = await generateStory(words);
    return NextResponse.json({ story, words });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to generate the story" }, { status: 500 });
  }
}
