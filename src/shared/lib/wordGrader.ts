import { callGroq } from "@/shared/lib/groq";
import { repo } from "@/shared/lib/repository";
import { computePriority } from "@/shared/lib/priority";
import type { Word } from "@/entities/word/model";

// How many words go into one Groq call. Large enough to keep the total
// number of requests (and free-tier rate-limit exposure) reasonable for a
// 300+ word list, small enough that one bad response only costs re-grading
// 40 words, not the whole list.
const GRADE_BATCH_SIZE = 40;

export interface WordGrade {
  frequency: number; // 1..100
  ieltsRelevant: boolean;
  activeWorthy: boolean;
  reason: string;
}

function buildPrompt(words: { word: string; tr1: string }[]): string {
  const list = words.map((w, i) => `${i + 1}. ${w.word} — ${w.tr1 || "(no translation)"}`).join("\n");
  return (
    `You are helping prioritize a personal English-vocabulary learner's word list for study.\n` +
    `For each word below (already known to the learner, Russian translation given only for context), judge:\n` +
    `- frequency: an integer 1-100, how common this word is in everyday/general English ` +
    `(1 = extremely rare or highly specialized, 50 = moderately common, 100 = as common as "the", "go", "good").\n` +
    `- ieltsRelevant: true if this is the kind of word that shows up in IELTS reading/writing/academic contexts.\n` +
    `- activeWorthy: true if the learner should be able to actively PRODUCE this word themselves (speak or write it) ` +
    `— general-purpose verbs, common adjectives, everyday nouns. false if it's only worth recognizing passively ` +
    `— rare or technical terms, words that are awkward to produce naturally, words whose main value is understanding them while reading.\n` +
    `- reason: under 8 words explaining the activeWorthy call specifically.\n\n` +
    `Words:\n${list}\n\n` +
    `Reply with a strict JSON array only, no other text, one object per word, in the same order as given:\n` +
    `[{"word":"...","frequency":1,"ieltsRelevant":true,"activeWorthy":true,"reason":"..."}]`
  );
}

// Matched by the word string the model echoes back, not by array position —
// a reasoning model skipping or reordering an item is more likely than it
// silently shifting every later item by one, and matching by content means a
// dropped item only loses that one word instead of misattributing every word after it.
export function parseGradeResponse(raw: string): Map<string, WordGrade> {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Groq did not return a JSON array");
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("Groq's response wasn't a JSON array");

  const out = new Map<string, WordGrade>();
  for (const item of parsed) {
    const word = String(item?.word ?? "").trim().toLowerCase();
    const frequency = Number(item?.frequency);
    if (!word || !Number.isFinite(frequency)) continue;
    out.set(word, {
      frequency: Math.max(1, Math.min(100, Math.round(frequency))),
      ieltsRelevant: Boolean(item?.ieltsRelevant),
      activeWorthy: Boolean(item?.activeWorthy),
      reason: String(item?.reason ?? "").slice(0, 200),
    });
  }
  return out;
}

export async function gradeWordBatch(words: { word: string; tr1: string }[]): Promise<Map<string, WordGrade>> {
  if (words.length === 0) return new Map();
  const raw = await callGroq(
    [{ role: "user", content: buildPrompt(words) }],
    { temperature: 0.2, maxTokens: 300 + words.length * 60 }
  );
  return parseGradeResponse(raw);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface GradeAllResult {
  gradedCount: number;
  unmatched: string[]; // words Groq's response didn't include — ungraded this pass, safe to retry
  batchCount: number;
}

// Grades every given word and saves the result (including a freshly
// recomputed priority) via the repository — one Groq call per GRADE_BATCH_SIZE
// words, sequentially (not Promise.all — no need to hammer the free tier with
// a burst, and callGroq already retries transient failures on its own).
export async function gradeAndSaveWords(words: Word[]): Promise<GradeAllResult> {
  const batches = chunk(words, GRADE_BATCH_SIZE);
  let gradedCount = 0;
  const unmatched: string[] = [];
  const gradedAt = new Date().toISOString();

  for (const batch of batches) {
    const grades = await gradeWordBatch(batch.map((w) => ({ word: w.word, tr1: w.tr1 })));
    for (const w of batch) {
      const grade = grades.get(w.word.trim().toLowerCase());
      if (!grade) {
        unmatched.push(w.word);
        continue;
      }
      await repo.update(w.id, {
        frequency: grade.frequency,
        ieltsRelevant: grade.ieltsRelevant,
        activeWorthy: grade.activeWorthy,
        gradeReason: grade.reason,
        gradedAt,
        priority: computePriority({
          frequency: grade.frequency,
          ieltsRelevant: grade.ieltsRelevant,
          correctStreak: w.correctStreak,
          batchId: w.batchId,
          firstSeenAt: w.firstSeenAt,
          debtSince: w.debtSince,
        }),
      });
      gradedCount++;
    }
  }

  return { gradedCount, unmatched, batchCount: batches.length };
}
