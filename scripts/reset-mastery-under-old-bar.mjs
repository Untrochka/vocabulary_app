// One-time: words marked "Изучен активно" under the old bar (5 reps + 3-day
// interval, which let a handful of near-misses still count) don't
// automatically qualify under the new one (a clean correctStreak of 4 + a
// 14-day interval). correctStreak only started being tracked when this
// script was written, so every existing word has correctStreak = 0 — none
// of them can currently satisfy the new bar no matter their real history.
// Demotes them to "Выбран для активного изучения" (still actively practiced,
// just no longer flagged as mastered) so they re-earn the status honestly
// under the same rule new words are held to, instead of grandfathering
// them in under a bar the rest of the list no longer uses.
//
// Usage: node scripts/reset-mastery-under-old-bar.mjs [--dry-run]

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DRY_RUN = process.argv.includes("--dry-run");
const STATUS_ACTIVE = "Изучен активно";
const STATUS_PICKED_ACTIVE = "Выбран для активного изучения";

async function main() {
  const prisma = new PrismaClient();
  const toReset = await prisma.word.findMany({
    where: { status: STATUS_ACTIVE },
    select: { id: true, word: true, correctStreak: true, activeInterval: true },
  });

  console.log(`${toReset.length} words currently marked "${STATUS_ACTIVE}".`);
  console.log(toReset.map((w) => w.word).join(", "));

  if (DRY_RUN) {
    console.log("\n--dry-run: no writes performed.");
    await prisma.$disconnect();
    return;
  }

  const res = await prisma.word.updateMany({
    where: { status: STATUS_ACTIVE },
    data: { status: STATUS_PICKED_ACTIVE },
  });
  await prisma.$disconnect();
  console.log(`\nDone. Demoted ${res.count} words to "${STATUS_PICKED_ACTIVE}".`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
