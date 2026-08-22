// Offline generator for speaking-drill topics: no network, no paid APIs,
// just templates + a random pick of today's words.

export interface SpeakingWord {
  word: string;
  tr1?: string;
}

type Template = (words: string[]) => string;

const list = (words: string[]) => words.join(", ");

const TEMPLATES: Template[] = [
  (w) => `Tell a story (2 min) about something that happened in your life. Be sure to use: ${list(w)}.`,
  (w) => `Describe your typical day from waking up to going to sleep, working in: ${list(w)}.`,
  (w) => `Argue with yourself "for and against" some decision (moving, changing jobs, etc.), using: ${list(w)}.`,
  (w) => `Describe an imaginary "what if..." situation, using: ${list(w)}.`,
  (w) => `Describe a person or place that stuck in your memory, using: ${list(w)}.`,
  (w) => `Talk about your plans for next week, using: ${list(w)}.`,
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildSpeakingPrompts(words: SpeakingWord[], count = 3, perPrompt = 5): string[] {
  if (words.length === 0) return [];

  const pool = shuffle(words.map((w) => w.word));
  const templates = shuffle(TEMPLATES).slice(0, Math.min(count, TEMPLATES.length));

  return templates.map((tpl, i) => {
    const start = (i * perPrompt) % pool.length;
    const group = Array.from({ length: Math.min(perPrompt, pool.length) }, (_, k) => pool[(start + k) % pool.length]);
    return tpl(Array.from(new Set(group)));
  });
}
