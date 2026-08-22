import { fetchTranslation } from "@/shared/lib/translate";
import { lemmatize } from "@/shared/lib/lemmatize";
import type { SessionCard, SessionResponse } from "@/entities/session/model";

// Max number of words that go into one story. Independent of how many words
// are actually due for review today — without a cap, a large due queue would
// make the prompt (and the free-tier bill) grow unpredictably. 16 words in a
// 300-450 word story still reads as coherent text, not a list of sentences.
export const READING_MAX_WORDS = 16;
const READING_MIN_STORY_WORDS = 300;
const READING_MAX_STORY_WORDS = 450;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Groq pulled llama-3.3-70b-versatile and llama-3.1-8b-instant from the free
// tier (deprecated June 17, 2026, fully shut down August 16) —
// openai/gpt-oss-120b is the official replacement, also available for free.
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export interface ReadingWord { word: string; tr1: string; }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 429 (rate limit) and 5xx (temporary overload) on Groq's free tier often
// self-recover within seconds — same backoff principle as for Notion in
// notionResilience.ts, just without a shared queue: Groq requests don't
// write to a shared resource and don't need ordering. Retrying other 4xx
// codes besides 429 (invalid model, bad key) is pointless — it won't succeed on a second try either.
const isTransientStatus = (status: number) => status === 429 || status >= 500;

// Shared Groq call with a timeout — both story generation and contextual
// translation of a word from it use the same endpoint and wrapper.
//
// openai/gpt-oss-* are reasoning models: before the final answer they first
// "think" in a separate channel, and that also costs tokens from the overall
// limit. If max_tokens is too small, the whole budget goes to reasoning and
// content comes back empty (documented Groq behavior, not a bug on our end)
// — hence the headroom in maxTokens below and reasoning_effort: "low", so we
// don't spend the budget on reasoning where the task is simple anyway.
async function callGroq(
  messages: { role: string; content: string }[],
  opts: { temperature: number; maxTokens: number },
  attempt = 0
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: opts.temperature,
        max_completion_tokens: opts.maxTokens,
        reasoning_effort: "low",
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (isTransientStatus(res.status) && attempt < 1) {
      await sleep(1000 * 2 ** attempt);
      return callGroq(messages, opts, attempt + 1);
    }
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API returned error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    const reason = data?.choices?.[0]?.finish_reason;
    throw new Error(
      reason === "length"
        ? "Groq cut off the response at the token limit before reaching the text — increase maxTokens in reading.ts"
        : "Groq returned an empty response"
    );
  }
  return content;
}

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
