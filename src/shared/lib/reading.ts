import { fetchTranslation } from "@/shared/lib/translate";
import { lemmatize } from "@/shared/lib/lemmatize";
import { callGroq } from "@/shared/lib/groq";
import type { SessionCard, SessionResponse } from "@/entities/session/model";
import type { Word } from "@/entities/word/model";

// Max number of words that go into one story. Independent of how many words
// are actually due for review today — without a cap, a large due queue would
// make the prompt (and the free-tier bill) grow unpredictably. 16 words in a
// 300-450 word story still reads as coherent text, not a list of sentences.
export const READING_MAX_WORDS = 16;
const READING_MIN_STORY_WORDS = 300;
const READING_MAX_STORY_WORDS = 450;

export interface ReadingWord { word: string; tr1: string; }

// Words for the mini-reading — first what's being learned for the first
// time today (fresh in memory, context reinforces it), then what's already
// due for review. Deduped by id, since the same word can end up in both newActive and duePassive on the same day.
export function pickReadingWords(session: SessionResponse): ReadingWord[] {
  const pools: SessionCard[][] = [session.newToLearn, session.newActive, session.duePassive, session.dueActive];
  const seen = new Set<string>();
  const out: ReadingWord[] = [];
  for (const pool of pools) {
    for (const w of pool) {
      if (seen.has(w.id) || !w.tr1) continue;
      seen.add(w.id);
      out.push({ word: w.word, tr1: w.tr1 });
      if (out.length >= READING_MAX_WORDS) return out;
    }
  }
  return out;
}

// "Today" pulls from the live session (due reviews + new words), so it
// naturally includes words regardless of how long ago they were learned —
// but on a day with few new words and few due reviews, that pool can be
// thin, and a fully-mastered word may go a long time between due dates and
// simply never come up. Picking a specific day instead pulls every word
// whose learnedAt matches that date, independent of today's SRS due-state —
// this is how a story can include words you already know well.
export function listLearnedDays(words: Word[]): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const w of words) {
    if (!w.learnedAt || !w.tr1) continue;
    counts.set(w.learnedAt, (counts.get(w.learnedAt) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function pickReadingWordsForDay(words: Word[], day: string): ReadingWord[] {
  return words
    .filter((w) => w.learnedAt === day && w.tr1)
    .slice(0, READING_MAX_WORDS)
    .map((w) => ({ word: w.word, tr1: w.tr1 }));
}

// Generates a coherent story in English using all the given words — via
// Groq's free API (an OpenAI-compatible endpoint). maxTokens hard-caps both
// the story's length and the request cost — even without a paid key this stays within the free tier.
export async function generateStory(words: ReadingWord[]): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured. Get a free key at console.groq.com and add it to your environment variables."
    );
  }

  const list = words.map((w) => w.word).join(", ");
  const prompt =
    `Write one engaging, coherent short story in simple English (CEFR B1 level) for a language learner.\n` +
    `It must naturally use ALL of these words at least once each (you may inflect them — plural, past tense, etc.): ${list}.\n` +
    `Wrap every occurrence of a target word, in whatever form you used it, in double asterisks, like **word**.\n` +
    `Length: ${READING_MIN_STORY_WORDS}-${READING_MAX_STORY_WORDS} words. One coherent story with a beginning, middle and end — not a list of disconnected sentences.\n` +
    `Output only the story text — no title, no notes, no translation, no markdown besides the asterisks.`;

  return callGroq([{ role: "user", content: prompt }], { temperature: 0.85, maxTokens: 2000 });
}

export interface ContextualTranslation { tr1: string; tr2?: string; }

// Translates a word in its specific usage within the sentence, not as an
// impersonal dictionary list of meanings — this is the whole point of the
// reading feature: a word is memorized through the meaning it took on right
// here. If Groq is unavailable we fall back to the regular dictionary
// translation (translate.ts) by lemma — worse, but the feature doesn't break entirely.
export async function contextualTranslate(word: string, sentence: string): Promise<ContextualTranslation> {
  if (process.env.GROQ_API_KEY) {
    try {
      const prompt =
        `In this English sentence: "${sentence}"\n` +
        `Translate the word "${word}" into Russian, using specifically the meaning it has in this sentence — not a generic list of dictionary meanings.\n` +
        `Reply with strict JSON only, nothing else: {"ru": "translation", "pos": "noun|verb|adjective|adverb|other"}`;
      const raw = await callGroq([{ role: "user", content: prompt }], { temperature: 0.3, maxTokens: 400 });
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed?.ru) return { tr1: String(parsed.ru), tr2: parsed.pos ? String(parsed.pos) : undefined };
      }
    } catch {
      // silently fall through to the dictionary fallback below
    }
  }

  const dict = await fetchTranslation(lemmatize(word));
  if (dict?.tr1) return { tr1: dict.tr1, tr2: dict.tr2 };
  throw new Error("Failed to translate the word");
}
