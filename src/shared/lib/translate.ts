import { lemmatize } from "@/shared/lib/lemmatize";

// Auto-translation of English words and phrases into Russian.
// Sources (all work server-side, no Cloudflare):
//   • Google Translate  → translations grouped by part of speech (~100% coverage)
//   • Tatoeba           → a real bilingual example (EN — RU)
//   • dictionaryapi.dev → IPA transcription (when available)

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface PosGroup {
  pos: string; // "noun", "verb", "adjective"…
  terms: string[]; // translations in order of frequency
}

export interface TranslateResult {
  ipa?: string;
  tr1?: string; // translation(s) into Russian, comma-separated
  tr2?: string; // part of speech
  example?: string; // "English sentence — Русский перевод"
  main?: string; // main translation (fallback for phrases with no dictionary entry)
  byPos?: PosGroup[]; // all groups by part of speech (for the UI picker)
}

// ── Google Translate: main translation + groups by part of speech ─────────
async function googleTranslate(
  phrase: string,
): Promise<{ main: string; byPos: PosGroup[] } | null> {
  try {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&dt=bd&q=" +
      encodeURIComponent(phrase);
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const data = await res.json();

    // data[0] — main translation segments: [[translation, original, …], …]
    const main = (Array.isArray(data?.[0]) ? data[0] : [])
      .map((seg: any) => (Array.isArray(seg) ? seg[0] : ""))
      .filter(Boolean)
      .join("")
      .trim();

    // data[1] — dictionary: [[pos, [terms…], …], …]
    const byPos: PosGroup[] = [];
    if (Array.isArray(data?.[1])) {
      for (const group of data[1]) {
        const pos = group?.[0];
        const terms = group?.[1];
        if (typeof pos === "string" && Array.isArray(terms) && terms.length) {
          byPos.push({ pos, terms: terms.filter(Boolean).slice(0, 6) });
        }
      }
    }

    if (!main && !byPos.length) return null;
    return { main, byPos };
  } catch {
    return null;
  }
}

// ── IPA transcription of an English word ───────────────────────────────────
async function fetchIpa(word: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const entry = data?.[0];
    const ipa =
      entry?.phonetic ??
      entry?.phonetics?.find((p: any) => p?.text)?.text ??
      "";
    return ipa || undefined;
  } catch {
    return undefined;
  }
}

// ── Bilingual example from Tatoeba ─────────────────────────────────────────
async function fetchExample(phrase: string): Promise<string | undefined> {
  try {
    const url =
      "https://tatoeba.org/en/api_v0/search?from=eng&to=rus&sort=relevance&query=" +
      encodeURIComponent(phrase);
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return undefined;
    const data = await res.json();
    for (const r of data?.results ?? []) {
      const en = typeof r?.text === "string" ? r.text.trim() : "";
      const ru = (Array.isArray(r?.translations) ? r.translations.flat() : []).find(
        (t: any) => t?.lang === "rus" && t?.text,
      );
      if (en && ru?.text) return `${en} — ${String(ru.text).trim()}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Picks the group for the requested part of speech (exact match or prefix).
function pickPos(byPos: PosGroup[], pos?: string): PosGroup | undefined {
  if (pos) {
    const want = pos.trim().toLowerCase();
    const exact = byPos.find((g) => g.pos.toLowerCase() === want);
    if (exact) return exact;
    const pref = byPos.find((g) => g.pos.toLowerCase().startsWith(want));
    if (pref) return pref;
  }
  return byPos[0];
}

/**
 * Translates an English word/phrase into Russian.
 * @param opts.pos — desired part of speech ("noun", "verb"…); if given and found,
 *   the translation is taken from the corresponding group.
 */
export async function fetchTranslation(
  phrase: string,
  opts?: { pos?: string },
): Promise<TranslateResult | null> {
  const clean = phrase.trim();
  if (!clean) return null;
  const lemma = lemmatize(clean);

  const [g, ipa, example] = await Promise.all([
    googleTranslate(clean).then((r) => r ?? (lemma !== clean ? googleTranslate(lemma) : null)),
    fetchIpa(lemma),
    fetchExample(clean),
  ]);

  if (!g) return null;

  const chosen = pickPos(g.byPos, opts?.pos);
  const tr1 = chosen ? chosen.terms.slice(0, 4).join(", ") : g.main;
  const tr2 = chosen ? chosen.pos : opts?.pos?.trim() || "";

  return {
    ipa,
    example,
    tr1: tr1 || g.main || undefined,
    tr2: tr2 || undefined,
    main: g.main || undefined,
    byPos: g.byPos,
  };
}
