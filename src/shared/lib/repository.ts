import { Client } from "@notionhq/client";
import { NOTION_DB_ID, P } from "@/shared/config/app";
import type { SrsState } from "@/shared/lib/srs";
import { EMPTY_SRS } from "@/shared/lib/srs";
import type { Word, WordStatus, NewWordInput } from "@/entities/word/model";
import { notionCall } from "@/shared/lib/notionResilience";

// ── Storage contract. The UI and API depend ONLY on this,
// so Notion can be swapped for Postgres by rewriting just this file.
export interface WordsRepository {
  listAll(): Promise<Word[]>;
  get(id: string): Promise<Word | null>;
  update(id: string, fields: Partial<Word>): Promise<void>;
  create(words: NewWordInput[]): Promise<number>;
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const txt = (p: any) => (p?.rich_text?.[0]?.plain_text ?? "") as string;
const title = (p: any) => (p?.title?.[0]?.plain_text ?? "") as string;
const num = (p: any) => (typeof p?.number === "number" ? p.number : undefined);
const date = (p: any) => (p?.date?.start ?? null) as string | null;

function srsFrom(
  props: any,
  k: {
    reps: string;
    interval: string;
    ease: string;
    due: string;
    last: string;
  },
): SrsState {
  return {
    reps: num(props[k.reps]) ?? 0,
    interval: num(props[k.interval]) ?? 0,
    ease: num(props[k.ease]) ?? EMPTY_SRS.ease,
    due: date(props[k.due]),
    last: date(props[k.last]),
  };
}

function pageToWord(page: any): Word {
  const pr = page.properties;
  return {
    id: page.id,
    word: title(pr[P.word]),
    tr1: txt(pr[P.tr1]),
    tr2: txt(pr[P.tr2]),
    ipa: txt(pr[P.ipa]),
    example: txt(pr[P.example]),
    status: (pr[P.status]?.status?.name ?? "Не изучен") as WordStatus,
    strength: num(pr[P.strength]) ?? 0,
    learnedAt: date(pr[P.learnedAt]),
    passive: srsFrom(pr, {
      reps: P.pReps,
      interval: P.pInterval,
      ease: P.pEase,
      due: P.pDue,
      last: P.pLast,
    }),
    active: srsFrom(pr, {
      reps: P.aReps,
      interval: P.aInterval,
      ease: P.aEase,
      due: P.aDue,
      last: P.aLast,
    }),
  };
}

const rt = (s: string) => ({ rich_text: s ? [{ text: { content: s } }] : [] });
const dt = (s: string | null) => ({ date: s ? { start: s } : null });

function srsProps(
  s: SrsState,
  k: {
    reps: string;
    interval: string;
    ease: string;
    due: string;
    last: string;
  },
) {
  return {
    [k.reps]: { number: s.reps },
    [k.interval]: { number: s.interval },
    [k.ease]: { number: Math.round(s.ease * 100) / 100 },
    [k.due]: dt(s.due),
    [k.last]: dt(s.last),
  };
}

function fieldsToProps(f: Partial<Word>): Record<string, any> {
  const out: Record<string, any> = {};
  if (f.word !== undefined)
    out[P.word] = { title: [{ text: { content: f.word } }] };
  if (f.tr1 !== undefined) out[P.tr1] = rt(f.tr1);
  if (f.tr2 !== undefined) out[P.tr2] = rt(f.tr2);
  if (f.ipa !== undefined) out[P.ipa] = rt(f.ipa);
  if (f.example !== undefined) out[P.example] = rt(f.example);
  if (f.status !== undefined) out[P.status] = { status: { name: f.status } };
  if (f.strength !== undefined) out[P.strength] = { number: f.strength };
  if (f.learnedAt !== undefined) out[P.learnedAt] = dt(f.learnedAt);
  if (f.passive)
    Object.assign(
      out,
      srsProps(f.passive, {
        reps: P.pReps,
        interval: P.pInterval,
        ease: P.pEase,
        due: P.pDue,
        last: P.pLast,
      }),
    );
  if (f.active)
    Object.assign(
      out,
      srsProps(f.active, {
        reps: P.aReps,
        interval: P.aInterval,
        ease: P.aEase,
        due: P.aDue,
        last: P.aLast,
      }),
    );
  return out;
}

class NotionWordsRepository implements WordsRepository {
  async listAll(): Promise<Word[]> {
    const out: Word[] = [];
    let cursor: string | undefined = undefined;
    do {
      const res: any = await notionCall(
        () => notion.databases.query({ database_id: NOTION_DB_ID, start_cursor: cursor, page_size: 100 }),
        "listAll",
      );
      res.results.forEach((p: any) => out.push(pageToWord(p)));
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);
    return out;
  }

  async get(id: string): Promise<Word | null> {
    try {
      const page: any = await notionCall(() => notion.pages.retrieve({ page_id: id }), "get");
      return pageToWord(page);
    } catch {
      return null;
    }
  }

  async update(id: string, fields: Partial<Word>): Promise<void> {
    await notionCall(
      () => notion.pages.update({ page_id: id, properties: fieldsToProps(fields) as any }),
      "update",
    );
  }

  async create(words: NewWordInput[]): Promise<number> {
    let n = 0;
    for (const w of words) {
      await notionCall(
        () =>
          notion.pages.create({
            parent: { database_id: NOTION_DB_ID },
            properties: {
              [P.word]: { title: [{ text: { content: w.word } }] },
              [P.tr1]: rt(w.tr1 ?? ""),
              [P.tr2]: rt(w.tr2 ?? ""),
              [P.ipa]: rt(w.ipa ?? ""),
              [P.example]: rt(w.example ?? ""),
              [P.status]: { status: { name: "Не изучен" } },
            } as any,
          }),
        "create",
      );
      n++;
    }
    return n;
  }
}

// Active storage. To switch the DB — change only this line.
export const repo: WordsRepository = new NotionWordsRepository();
