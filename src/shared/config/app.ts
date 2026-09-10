// Tunable limits for the study session. Word storage itself is in Postgres
// now (see prisma/schema.prisma) — this file used to also hold the Notion
// field-name mapping, retired along with Notion as the word store.

export const CAPS = {
  passivePerDay: 8, // new words for passive recognition per day
  activePerDay: 12, // new words for active learning per day
  // Threshold for "learned actively": a word must clear both bars — enough
  // reps (activeMatureReps) AND enough accumulated interval (activeMatureDays).
  // 3 same-day steps + 2 rungs of the 1→3 ladder — maturity in ~4 days,
  // instead of the 7→14 it used to take with plain interval>=7.
  activeMatureReps: 5,
  activeMatureDays: 3,
  learnBatchSize: 5, // how many new words to learn in one pass before checking
  activeBatchSize: 4, // same, for active words
};

export const STATUS = {
  new: "Не изучен",
  pickedActive: "Выбран для активного изучения",
  passive: "Изучен пассивно",
  active: "Изучен активно",
} as const;
