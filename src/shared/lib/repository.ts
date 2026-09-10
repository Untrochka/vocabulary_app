import type { Prisma, Word as WordRow } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import type { SrsState } from "@/shared/lib/srs";
import { todayISO } from "@/shared/lib/srs";
import { STATUS } from "@/shared/config/app";
import type { Word, WordStatus, NewWordInput } from "@/entities/word/model";

// ── Storage contract. The UI and API depend ONLY on this — this is what let
// the whole word store move from Notion to this app's own Postgres without
// touching a single screen or API route (see scripts/migrate-notion-to-postgres.mjs
// for the one-time data migration).
export interface WordsRepository {
  listAll(): Promise<Word[]>;
  get(id: string): Promise<Word | null>;
  update(id: string, fields: Partial<Word>): Promise<void>;
  // Returns the created rows (with their real ids), not just a count — the
  // caller needs the ids to grade the new words right after creation.
  // batchId tags every word in this call as belonging to a PracticeBatch —
  // see shared/lib/practice.ts.
  create(words: NewWordInput[], batchId?: string): Promise<Word[]>;
}

function rowToWord(row: WordRow): Word {
  return {
    id: row.id,
    word: row.word,
    tr1: row.tr1,
    tr2: row.tr2,
    ipa: row.ipa,
    example: row.example,
    status: row.status as WordStatus,
    strength: row.strength,
    learnedAt: row.learnedAt,
    passive: {
      reps: row.passiveReps,
      interval: row.passiveInterval,
      ease: row.passiveEase,
      due: row.passiveDue,
      last: row.passiveLast,
    },
    active: {
      reps: row.activeReps,
      interval: row.activeInterval,
      ease: row.activeEase,
      due: row.activeDue,
      last: row.activeLast,
    },
    priority: row.priority,
    frequency: row.frequency,
    ieltsRelevant: row.ieltsRelevant,
    activeWorthy: row.activeWorthy,
    gradeReason: row.gradeReason,
    gradedAt: row.gradedAt ? row.gradedAt.toISOString() : null,
    correctStreak: row.correctStreak,
    lapses: row.lapses,
    debtSince: row.debtSince,
    firstSeenAt: row.firstSeenAt,
    batchId: row.batchId,
  };
}

function fieldsToData(f: Partial<Word>): Prisma.WordUpdateInput {
  const out: Prisma.WordUpdateInput = {};
  if (f.word !== undefined) out.word = f.word;
  if (f.tr1 !== undefined) out.tr1 = f.tr1;
  if (f.tr2 !== undefined) out.tr2 = f.tr2;
  if (f.ipa !== undefined) out.ipa = f.ipa;
  if (f.example !== undefined) out.example = f.example;
  if (f.status !== undefined) out.status = f.status;
  if (f.strength !== undefined) out.strength = f.strength;
  if (f.learnedAt !== undefined) out.learnedAt = f.learnedAt;
  if (f.passive) applySrs(out, "passive", f.passive);
  if (f.active) applySrs(out, "active", f.active);
  if (f.priority !== undefined) out.priority = f.priority;
  if (f.frequency !== undefined) out.frequency = f.frequency;
  if (f.ieltsRelevant !== undefined) out.ieltsRelevant = f.ieltsRelevant;
  if (f.activeWorthy !== undefined) out.activeWorthy = f.activeWorthy;
  if (f.gradeReason !== undefined) out.gradeReason = f.gradeReason;
  if (f.gradedAt !== undefined) out.gradedAt = f.gradedAt;
  if (f.correctStreak !== undefined) out.correctStreak = f.correctStreak;
  if (f.lapses !== undefined) out.lapses = f.lapses;
  if (f.debtSince !== undefined) out.debtSince = f.debtSince;
  if (f.firstSeenAt !== undefined) out.firstSeenAt = f.firstSeenAt;
  if (f.batchId !== undefined) out.batchId = f.batchId;
  return out;
}

// Written out per-field (not via a computed `${prefix}Reps` key) so the
// result stays a real Prisma.WordUpdateInput the compiler can check —
// dynamic keys would force this back to Record<string, unknown> and an `any` cast.
function applySrs(out: Prisma.WordUpdateInput, prefix: "passive" | "active", s: SrsState) {
  if (prefix === "passive") {
    out.passiveReps = s.reps;
    out.passiveInterval = s.interval;
    out.passiveEase = s.ease;
    out.passiveDue = s.due;
    out.passiveLast = s.last;
  } else {
    out.activeReps = s.reps;
    out.activeInterval = s.interval;
    out.activeEase = s.ease;
    out.activeDue = s.due;
    out.activeLast = s.last;
  }
}

class PostgresWordsRepository implements WordsRepository {
  async listAll(): Promise<Word[]> {
    const rows = await prisma.word.findMany();
    return rows.map(rowToWord);
  }

  async get(id: string): Promise<Word | null> {
    const row = await prisma.word.findUnique({ where: { id } });
    return row ? rowToWord(row) : null;
  }

  async update(id: string, fields: Partial<Word>): Promise<void> {
    await prisma.word.update({ where: { id }, data: fieldsToData(fields) });
  }

  async create(words: NewWordInput[], batchId?: string): Promise<Word[]> {
    const today = todayISO();
    const rows = await prisma.word.createManyAndReturn({
      data: words.map((w) => ({
        word: w.word,
        tr1: w.tr1 ?? "",
        tr2: w.tr2 ?? "",
        ipa: w.ipa ?? "",
        example: w.example ?? "",
        status: STATUS.new,
        firstSeenAt: today,
        batchId: batchId ?? null,
      })),
    });
    return rows.map(rowToWord);
  }
}

// Active storage. To switch the DB again — change only this line.
export const repo: WordsRepository = new PostgresWordsRepository();
