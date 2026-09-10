import type { SessionCard, SessionResponse } from "@/entities/session/model";
import { CAPS } from "@/shared/config/app";

export type Mode =
  | "learnShow" // new word: show + "Got it"
  | "learnCheck" // new word: check right after showing
  | "passive" // review — recognition
  | "activeLearnShow" // active word: show + "Got it"
  | "activeLearnCheck" // active word: check right after showing
  | "active" // review — production
  | "divider"; // transition from "new" to "review"

export interface Item { type: Mode; word: SessionCard | null; }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type QueueInput = Pick<SessionResponse, "newToLearn" | "duePassive" | "newActive" | "dueActive">;

// Builds the lesson queue from the /api/session response: debt words first
// as a warm-up (regardless of track — a word you failed yesterday shouldn't
// wait behind a pile of brand-new ones), then the new-word blocks (show + an
// immediate check, in batches of CAPS.*BatchSize), then the rest of the due
// reviews. The divider is only inserted if there's actually something to
// review passively after the new words — we don't show an empty transition screen.
export function buildStudyQueue(session: QueueInput): Item[] {
  const duePassiveAll = session.duePassive ?? [];
  const dueActiveAll = session.dueActive ?? [];

  const warmup: Item[] = [
    ...duePassiveAll.filter((w) => w.isDebt).map((w) => ({ type: "passive" as Mode, word: w })),
    ...dueActiveAll.filter((w) => w.isDebt).map((w) => ({ type: "active" as Mode, word: w })),
  ];

  const learnGroups: Item[] = chunk(session.newToLearn ?? [], CAPS.learnBatchSize).flatMap((g) => [
    ...g.map((w) => ({ type: "learnShow" as Mode, word: w })),
    ...g.map((w) => ({ type: "learnCheck" as Mode, word: w })),
  ]);

  const duePassive: Item[] = duePassiveAll.filter((w) => !w.isDebt).map((w) => ({ type: "passive" as Mode, word: w }));

  const activeGroups: Item[] = chunk(session.newActive ?? [], CAPS.activeBatchSize).flatMap((g) => [
    ...g.map((w) => ({ type: "activeLearnShow" as Mode, word: w })),
    ...g.map((w) => ({ type: "activeLearnCheck" as Mode, word: w })),
  ]);

  const dueActive: Item[] = dueActiveAll.filter((w) => !w.isDebt).map((w) => ({ type: "active" as Mode, word: w }));

  return [
    ...warmup,
    ...learnGroups,
    ...(learnGroups.length && duePassive.length ? [{ type: "divider" as Mode, word: null }] : []),
    ...duePassive,
    ...activeGroups,
    ...dueActive,
  ];
}
