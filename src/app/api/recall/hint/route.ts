import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { firstLetterHint, synonymHint } from "@/shared/lib/recall";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Level 1 is free (just the first letter); level 2 costs a Groq call (an
// easier synonym). Either way this is the only place the word's identity
// leaks at all before an answer is checked — by the learner's own request.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const wordId = url.searchParams.get("wordId") ?? "";
    const level = url.searchParams.get("level") === "2" ? 2 : 1;
    if (!wordId) return NextResponse.json({ error: "wordId is required" }, { status: 400 });

    const w = await repo.get(wordId);
    if (!w) return NextResponse.json({ error: "Word not found" }, { status: 404 });

    const hint = level === 1 ? firstLetterHint(w.word) : await synonymHint(w.word);
    return NextResponse.json({ hint });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to get a hint" }, { status: 500 });
  }
}
