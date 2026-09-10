// Tunable limits for the study session. Word storage itself is in Postgres
// now (see prisma/schema.prisma) — this file used to also hold the Notion
// field-name mapping, retired along with Notion as the word store.

export const CAPS = {
  passivePerDay: 8, // new words for passive recognition per day
  activePerDay: 12, // new words for active learning per day
  // Threshold for "learned actively": a word must clear both bars — a clean
  // streak of consecutive correct active reviews (any single miss resets
  // it to 0 — see correctStreak in study/route.ts) AND the accumulated SRS
  // interval. Replaces the old 5-reps/3-days bar, which let reps climb even
  // through near-misses and called a word mature in ~4 days; this one takes
  // real weeks, on purpose — reps was measuring clicks, not retention.
  activeMatureStreak: 4,
  activeMatureDays: 14,
  learnBatchSize: 5, // how many new words to learn in one pass before checking
  activeBatchSize: 4, // same, for active words
};

export const STATUS = {
  new: "Не изучен",
  pickedActive: "Выбран для активного изучения",
  passive: "Изучен пассивно",
  active: "Изучен активно",
} as const;
