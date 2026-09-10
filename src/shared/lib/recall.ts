import { callGroq } from "@/shared/lib/groq";
import type { Word } from "@/entities/word/model";

// tr1 (the translation) is the only hint — the actual word is deliberately
// left out of this type. Recall means producing the word from memory, so
// the API must never hand the client the answer before it's checked.
export interface RecallWord { id: string; tr1: string; }

// Days that have words which had their first active review — mirrors
// listLearnedDays in reading.ts, but keyed on firstActiveAt instead of
// learnedAt: recall is specifically about words you started actively
// producing, not just recognizing, so "today's recall" should match
// "today's newly-active words," not "today's brand-new words."
export function listActiveDays(words: Word[]): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const w of words) {
    if (!w.firstActiveAt) continue;
    counts.set(w.firstActiveAt, (counts.get(w.firstActiveAt) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function pickRecallWords(words: Word[], day: string): RecallWord[] {
  return words.filter((w) => w.firstActiveAt === day).map((w) => ({ id: w.id, tr1: w.tr1 }));
}

export type RecallVerdict = "correct" | "partial" | "wrong";
export interface RecallJudgment { verdict: RecallVerdict; feedback: string; }

// correct -> Easy, partial -> Good, wrong -> Again (resets correctStreak,
// same as a mistyped answer in the normal active-review flow — see
// reviewOutcome.ts). "partial" covers a near-miss (typo, wrong inflection,
// a close synonym) — recognizably reaching for the right word without
// nailing it, which is worth more than a flat wrong.
export const RECALL_GRADE: Record<RecallVerdict, 0 | 2 | 3> = { correct: 3, partial: 2, wrong: 0 };

// Judges a recalled-from-memory guess against the actual target word —
// this is the point of recall mode: only the translation is shown as a
// hint, so producing the word itself (not just recognizing it) is what
// proves it's actually learned.
export async function judgeRecallGuess(word: string, tr1: string, guess: string): Promise<RecallJudgment> {
  const prompt =
    `A language learner was shown only the translation "${tr1}" and asked to recall, from memory, the English word for it.\n` +
    `The correct word is "${word}". They answered: "${guess}"\n\n` +
    `Judge their answer:\n` +
    `- "correct": it's the right word (minor typos or capitalization don't count against it).\n` +
    `- "partial": a near miss — wrong inflection/form of the same word, a close synonym, or a noticeably misspelled attempt at the right word.\n` +
    `- "wrong": a different word, unrelated, or blank/gave up.\n\n` +
    `Reply with strict JSON only, no other text: {"verdict": "correct"|"partial"|"wrong", "feedback": "one short sentence in Russian on what's right or what's missing"}`;

  const raw = await callGroq([{ role: "user", content: prompt }], { temperature: 0.3, maxTokens: 400 });
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Groq did not return a JSON object");
  const parsed = JSON.parse(match[0]);
  if (parsed?.verdict !== "correct" && parsed?.verdict !== "partial" && parsed?.verdict !== "wrong") {
    throw new Error("Groq returned an unrecognized verdict");
  }
  return { verdict: parsed.verdict, feedback: String(parsed?.feedback ?? "").slice(0, 300) };
}
