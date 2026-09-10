import { prisma } from "@/shared/lib/prisma";

// A practice batch is a dump of words added together from reading/listening
// — session.ts gives it a temporarily-raised daily cap so the whole thing
// can be learned same-day instead of trickling in over the usual week, and
// priority.ts gives its words a freshness boost that decays over a week.
export async function createPracticeBatch(source: string | null): Promise<string> {
  const batch = await prisma.practiceBatch.create({ data: { source: source || null } });
  return batch.id;
}

// A batch counts as done once every word in it has had its first passive
// pass (reps > 0) — the same "started learning" signal used elsewhere
// (countLearnedPassiveToday), not full mastery. Called after each "learn"
// action on a word that belongs to a batch; no-ops once completedAt is set.
export async function maybeCompletePracticeBatch(batchId: string): Promise<void> {
  const remaining = await prisma.word.count({ where: { batchId, passiveReps: 0 } });
  if (remaining === 0) {
    await prisma.practiceBatch.updateMany({
      where: { id: batchId, completedAt: null },
      data: { completedAt: new Date() },
    });
  }
}
