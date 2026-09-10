// One-time migration: copies every word + its SRS state from Notion into the
// new Postgres `words` table. Read-only on the Notion side — never writes,
// never deletes anything there, safe to re-run (upserts by id, using the
// original Notion page id as the Postgres row id — see schema.prisma).
//
// Usage:
//   node scripts/migrate-notion-to-postgres.mjs --dry-run   # fetch + report, no writes
//   node scripts/migrate-notion-to-postgres.mjs             # actually migrate
//
// Reads DATABASE_URL/DIRECT_URL and NOTION_TOKEN/NOTION_DATABASE_ID from .env.local
// (same file the app itself uses — this is a standalone script, not part of the Next.js build).

import { readFileSync } from "fs";
import { Client } from "@notionhq/client";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DRY_RUN = process.argv.includes("--dry-run");

// Same field-name mapping as the (now retired) shared/lib/repository.ts —
// duplicated here rather than imported since this script runs outside
// Next.js's module resolution (no @/ path aliases, no TS transform).
const P = {
  word: "Слово",
  tr1: "Определение",
  tr2: "Часть речи",
  ipa: "Транскрипция",
  example: "Пример",
  status: "Статус",
  strength: "Сила знания (%)",
  learnedAt: "Дата изучения",
  pReps: "П_Повторений",
  pInterval: "П_Интервал ",
  pEase: "П_Лёгкость",
  pDue: "П_Следующий_Повтор ",
  pLast: "П_Последнее_Повторение",
  aReps: "А_Повторений ",
  aInterval: "А_Интервал ",
  aEase: "А_Лёгкость",
  aDue: "А_Следующий_Повтор",
  aLast: "А_Последнее_Повторение",
};

const txt = (p) => p?.rich_text?.[0]?.plain_text ?? "";
const title = (p) => p?.title?.[0]?.plain_text ?? "";
const num = (p) => (typeof p?.number === "number" ? p.number : undefined);
const date = (p) => p?.date?.start ?? null;

function pageToRow(page) {
  const pr = page.properties;
  return {
    id: page.id,
    word: title(pr[P.word]),
    tr1: txt(pr[P.tr1]),
    tr2: txt(pr[P.tr2]),
    ipa: txt(pr[P.ipa]),
    example: txt(pr[P.example]),
    status: pr[P.status]?.status?.name ?? "Не изучен",
    strength: num(pr[P.strength]) ?? 0,
    learnedAt: date(pr[P.learnedAt]),
    passiveReps: num(pr[P.pReps]) ?? 0,
    passiveInterval: num(pr[P.pInterval]) ?? 0,
    passiveEase: num(pr[P.pEase]) ?? 2.5,
    passiveDue: date(pr[P.pDue]),
    passiveLast: date(pr[P.pLast]),
    activeReps: num(pr[P.aReps]) ?? 0,
    activeInterval: num(pr[P.aInterval]) ?? 0,
    activeEase: num(pr[P.aEase]) ?? 2.5,
    activeDue: date(pr[P.aDue]),
    activeLast: date(pr[P.aLast]),
  };
}

async function fetchAllFromNotion() {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const dbId = (process.env.NOTION_DATABASE_ID || "").replace(/-/g, "");
  const rows = [];
  let cursor;
  do {
    const res = await notion.databases.query({ database_id: dbId, start_cursor: cursor, page_size: 100 });
    res.results.forEach((p) => rows.push(pageToRow(p)));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function main() {
  console.log(`Fetching words from Notion (database ${process.env.NOTION_DATABASE_ID})...`);
  const rows = await fetchAllFromNotion();
  console.log(`Found ${rows.length} words.`);

  const byStatus = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  console.log("By status:", byStatus);
  console.log("Sample:", JSON.stringify(rows[0], null, 2));

  if (DRY_RUN) {
    console.log("\n--dry-run: no writes performed.");
    return;
  }

  const prisma = new PrismaClient();
  let written = 0;
  for (const r of rows) {
    await prisma.word.upsert({
      where: { id: r.id },
      create: r,
      update: r,
    });
    written++;
    if (written % 50 === 0) console.log(`  ${written}/${rows.length}...`);
  }
  await prisma.$disconnect();
  console.log(`\nDone. Wrote ${written} words to Postgres.`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
