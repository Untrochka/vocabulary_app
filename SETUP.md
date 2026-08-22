# Self-Hosting Setup

This is a personal, single-user app — there's no multi-tenant hosted version. If you want to run your own copy against your own Notion database, this is the config it needs. (The verification log at the bottom documents an earlier debugging pass on this codebase, kept for transparency — see the [README](README.md) for the fuller story of how this app evolved.)

## `.env` setup

Copy `.env.example` to `.env.local` (for local development) and/or enter the same variables in Vercel → Project Settings → Environment Variables (for production).

```
NOTION_TOKEN=...            # already existed
NOTION_DATABASE_ID=...      # already existed

DATABASE_URL=...
DIRECT_URL=...

TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
APP_URL=...
CRON_SECRET=...

GROQ_API_KEY=...           # optional — only /reading won't work without it
GROQ_MODEL=openai/gpt-oss-120b   # optional, this is already the default
```

### Postgres (Neon, free tier)
1. Go to [neon.tech](https://neon.tech), create a project.
2. In Dashboard → Connection Details, copy the **pooled** connection string (it has `-pooler` in the host) → this is `DATABASE_URL`.
3. In the same place, switch to **Direct connection** (without `-pooler`) → this is `DIRECT_URL` (only needed for migrations).
4. The Prisma CLI reads variables from a file named `.env` (not `.env.local` — those are different things, `.env.local` is only understood by Next.js itself). Copy `DATABASE_URL`/`DIRECT_URL` into it:
   ```bash
   grep -E "^(DATABASE_URL|DIRECT_URL)=" .env.local > .env
   ```
   `.env` is already in `.gitignore`, so it won't end up in the repository.
5. Locally: `pnpm db:migrate` — creates the `daily_activity` and `streak_state` tables.
6. On Vercel: after the first deploy, run `pnpm db:deploy` (or run the migration locally, pointing `.env` at the production `DATABASE_URL`/`DIRECT_URL` before `pnpm db:migrate`).

### Telegram bot
1. In Telegram, message [@BotFather](https://t.me/BotFather) → `/newbot` → follow the instructions → you'll get a token like `123456:ABC-...`. This is `TELEGRAM_BOT_TOKEN`.
2. Make up any random string (16+ characters) for `TELEGRAM_WEBHOOK_SECRET` — just a secret so nobody else can send commands to the bot.
3. `APP_URL` — your deployment's address, e.g. `https://slovar.vercel.app` (no trailing slash).
4. Deploy the app to Vercel with the variables above already filled in.
5. Register the webhook with one request (substitute your own values):
   ```
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
6. Message `/start` to your bot — you'll get your `chat_id` back in reply. Put it in the `TELEGRAM_CHAT_ID` variable and redeploy (or update the env var on Vercel and redeploy).
7. `CRON_SECRET` — another random string (16+ characters); Vercel automatically supplies it in the header when calling `/api/cron/*`, you never need to enter it manually anywhere, just set the value in Environment Variables.

### Notification time
`vercel.json` is currently set to `04:15 UTC` (morning) and `15:00 UTC` (evening) — calculated for Tashkent (UTC+5, ≈9:15 and 20:00 local time). If your time zone is different — adjust the `schedule` in `vercel.json` (cron is always in UTC). On Vercel's Hobby plan, timing isn't guaranteed to the minute — the notification may arrive within an hour of the scheduled time, and each cron job can't fire more than once a day (for two separate cron jobs, as here, that's not an issue).

---

## Appendix: a debugging pass from before the portfolio cleanup

This section is a dev log from an earlier round of fixes on this codebase — kept as-is for transparency rather than cleaned up or deleted, since it's evidence of a real review-and-fix cycle. It predates the refactor pass described in the README.

### What was broken

1. **Active practice didn't check the answer.** In `ActiveBody`, the input field had no `value`/`onChange` — purely decorative. The "Изучен активно" (learned actively) status was set by pressing the Again/Hard/Good/Easy buttons, i.e. by self-assessment, without a single real comparison of the typed word against the correct one. As a result, words were marked as learned without any confirmation.
2. **Silent loss of the answer on a Notion write failure.** `catch {}` in `send()` swallowed the error and still advanced to the next card — the answer looked saved, but in fact wasn't recorded.
3. No retry/backoff at all on Notion writes — on a 429 or a transient error, everything just failed with no retry.
4. Debug `console.log(res.results)` on every `listAll()` call.
5. No protection against junk words when adding (broken speech-to-text results like "fel", "attle").
6. The "flame" on the home screen showed the number of mastered words (`counts.mastered`), not an actual day streak — visually passing itself off as a streak that didn't exist.
7. Streaks / `daily_activity` didn't exist at all — no backend, no DB.
8. There was no Telegram bot at all.
9. The design was a generic game-flashcard template, not tied to the app's actual purpose (an IELTS vocabulary trainer).

The Notion schema was verified directly through the Notion API — all field names in `src/shared/config/app.ts`, including trailing spaces (`"А_Интервал "`, `"А_Повторений "`, `"П_Интервал "`, `"П_Следующий_Повтор "`), match the real database 1:1. Field mapping wasn't changed — it wasn't the cause of the instability.

### What was fixed

- **Honest active practice** — `src/screens/StudyScreen.tsx` (`ActiveBody`): a strict comparison of the typed word (no hints), the grading buttons only appear after a correct answer; on a mistake — an immediate "Incorrect", and the word goes back into the queue.
- **Write reliability** — `src/shared/lib/notionResilience.ts`: one retry with backoff on 429/5xx, all calls go through a shared queue (no parallel request storm). Wired into `src/shared/lib/repository.ts`.
- **No lost answers** — `src/shared/lib/studyApi.ts` + `src/shared/lib/offlineQueue.ts`: if Notion returned an error even after the retry — a banner in the UI with a "Retry" button, the card isn't counted as done on its own. If there's no network at all — the answer goes into an offline queue (IndexedDB) and is sent automatically once the network is back (`src/shared/ui/OfflineSync.tsx`).
- **Client-side error log** — `src/shared/lib/errorLog.ts`, a ring buffer in localStorage plus `window.onerror`/`unhandledrejection` capture.
- **Junk filter** — `src/shared/lib/wordValidation.ts`: a structural check plus rejection of words for which auto-translate genuinely found nothing. Such words aren't created in Notion and are listed to the user as skipped.
- **Honest streaks** — `prisma/schema.prisma` + `src/shared/lib/streaks.ts`: a separate Postgres DB (`daily_activity`, `streak_state`), daily minimum = 1 active review OR 1 new word, on a missed day — a neutral message: "streak broke, a new one starts today", no guilt-tripping.
- **Redesign** — new typography (Fraunces + IBM Plex Sans/Mono), a new palette (warm "ink" tones, no templated purple gradient), a dictionary-style word card (word in a serif face, IPA in monospace, part of speech in italics), a weekly activity strip on the home screen.
- **Telegram bot** — `src/app/api/telegram/webhook`, `src/app/api/cron/morning`, `src/app/api/cron/evening`: two neutral notifications a day (morning — if you haven't started yet today, evening — if the daily minimum isn't met), a deep-link button goes straight to `/study`. Runs inside Next.js via Vercel Cron — no separate service needed.

### How it was verified manually

**Honest active practice**
1. Open `/study`, get to the "Checking an active word" / "Active practice" card.
2. Enter a deliberately wrong word → "Incorrect · you wrote: …" should appear, the correct answer is shown, and the only button is "Next" (no self-assessment).
3. Open the same database in Notion — the word's `Статус` should not have moved to "Изучен активно", `А_Повторений`/`А_Интервал` should not have grown (the interval resets on a lapse).
4. Enter the correct word → "Correct" and only the Hard/Good/Easy buttons. Press any of them — in Notion, that word's `А_Повторений`, `А_Интервал`, `А_Следующий_Повтор` should update.
5. Check the criterion for moving to "Изучен активно": it only happens after ≥5 successful active reviews with an interval of ≥3 days between them (`CAPS.activeMatureReps`/`activeMatureDays` in `src/shared/config/app.ts`) — measured in real days, not within a single session.

**Reliability**
1. Turn off your internet right in the middle of a session, answer a card → the app shouldn't freeze or silently continue; you should either see an error with "Retry", or (if offline) the session just continues and the answer goes into the queue, sent once you turn the network back on (check in DevTools → Application → IndexedDB → `vocab-offline-queue`).
2. Add a deliberately junk line in "Batch" (e.g. `fel, attle, put your fit in it somehow today`) → the message after adding should include "skipped as gibberish: …".

**Streaks**
1. After setting up Postgres, do at least one active review or add a new word.
2. The home screen should show a filled cell in the weekly strip and the number next to 🔥 should grow.
3. Skip a day and come back — the streak should correctly reset with a neutral caption, not silently fail or crash.

**Telegram bot**
1. After deploying and configuring it, send `/start` to your bot — you should get a reply with your `chat_id`.
2. Wait for a cron call (or trigger `/api/cron/morning`/`/api/cron/evening` manually with the header `Authorization: Bearer <CRON_SECRET>`) — you should receive a message with an honest word count and a "Review now" button leading to `/study`.

### What wasn't touched in that pass

- Notion field names and types — left untouched.
- The SM-2 algorithm, daily limits, dedup on adding — were already in good shape from earlier fixes, not rewritten.
