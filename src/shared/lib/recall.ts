import { callGroq } from "@/shared/lib/groq";
import type { Word } from "@/entities/word/model";

// Nothing about the word — not even its translation — goes to the client
// by default. Recall means producing both the word and its meaning purely
// from memory; the only cue is a hint the learner explicitly asks for.
export interface RecallWord { id: string; }

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
  return words.filter((w) => w.firstActiveAt === day).map((w) => ({ id: w.id }));
}

export type RecallVerdict = "correct" | "partial" | "wrong";
export interface RecallJudgment { verdict: RecallVerdict; feedback: string; }

// correct -> Easy, partial -> Good, wrong -> Again (resets correctStreak,
// same as a mistyped answer in the normal active-review flow — see
// reviewOutcome.ts). "partial" covers a near-miss on either half of the
// answer (the word or the explanation) — reaching for it without quite
// nailing it, which is worth more than a flat wrong.
export const RECALL_GRADE: Record<RecallVerdict, 0 | 2 | 3> = { correct: 3, partial: 2, wrong: 0 };

// The free hint: no Groq call, just reveals the first letter.
export function firstLetterHint(word: string): string {
  return word.slice(0, 1).toUpperCase();
}

// The costlier hint: an easier, more common synonym — this needs real
// semantic judgment, so it's the one hint that goes through Groq.
export async function synonymHint(word: string): Promise<string> {
  const prompt =
    `Give exactly one simpler, more common English synonym for the word "${word}" — one a learner would already know.\n` +
    `Never use the word "${word}" itself or an obvious inflection of it.\n` +
    `Reply with just the synonym itself, nothing else — no punctuation, no explanation.`;

  const raw = await callGroq([{ role: "user", content: prompt }], { temperature: 0.5, maxTokens: 20 });
  return raw.trim().replace(/^["'.]+|["'.]+$/g, "");
}

// Judges a from-memory recall attempt — both the word itself and the
// learner's own explanation of its meaning — against the real word. This
// is the point of recall mode: no word, no translation is shown up front,
// so producing both from memory is what proves it's actually learned.
export async function judgeRecallAnswer(word: string, tr1: string, guess: string, explanation: string): Promise<RecallJudgment> {
  const prompt =
    `A language learner is trying to recall an English word entirely from memory — nothing was shown to them up front, only an optional hint if they asked for one (first letter, or an easier synonym).\n` +
    `The correct word is "${word}" (translation: "${tr1}").\n` +
    `They wrote the word as: "${guess || "(left blank)"}"\n` +
    `They explained its meaning, in their own words, as: "${explanation || "(left blank)"}"\n\n` +
    `Judge their overall answer:\n` +
    `- "correct": the word is right (minor typos are fine) and the explanation shows real understanding of its meaning.\n` +
    `- "partial": a near miss on one part — e.g. the right word but a vague/incomplete explanation, or a close synonym/wrong inflection of the word paired with a correct explanation.\n` +
    `- "wrong": neither part shows they actually know the word, or both were left blank.\n\n` +
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
