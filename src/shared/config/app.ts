// The single place with Notion field names and limits.
// If the fields are named differently in Notion — fix them only here.

export const NOTION_DB_ID = process.env.NOTION_DATABASE_ID || "";

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

// Notion database property names (RU). Must match the database exactly.
export const P = {
  word: "Слово", // title
  tr1: "Определение",
  tr2: "Часть речи",
  ipa: "Транскрипция",
  example: "Пример",
  status: "Статус", // select
  strength: "Сила знания (%)", // number 0..100
  learnedAt: "Дата изучения", // date
  // passive track
  pReps: "П_Повторений",
  pInterval: "П_Интервал ", // trailing space is part of the Notion field name
  pEase: "П_Лёгкость",
  pDue: "П_Следующий_Повтор ", // trailing space is part of the Notion field name
  pLast: "П_Последнее_Повторение",
  // active track
  aReps: "А_Повторений ", // trailing space is part of the Notion field name
  aInterval: "А_Интервал ", // trailing space is part of the Notion field name
  aEase: "А_Лёгкость",
  aDue: "А_Следующий_Повтор",
  aLast: "А_Последнее_Повторение",
} as const;

export const STATUS = {
  new: "Не изучен",
  pickedActive: "Выбран для активного изучения",
  passive: "Изучен пассивно",
  active: "Изучен активно",
} as const;
