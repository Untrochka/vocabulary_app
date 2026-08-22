# Vocabulary

A personal English vocabulary trainer built on top of my own Notion database — spaced repetition, honest active recall, and short AI-generated reading practice.

## What is this?

A single-user, no-accounts, no-subscriptions app for learning English words. The core idea: a word doesn't count as "learned" until you've recalled it twice — once by recognizing it in context, once by producing it yourself with no hints. Two independent SM-2 tracks (the same algorithm Anki uses) run in parallel — recognition and production are different skills with different forgetting curves, so they get separate review schedules instead of one blended score.

Four screens, nothing else:

- **Home** — streak, level, daily goal, this week's activity, today's plan (learn / review counts).
- **Study** — the lesson queue: new words, same-day reinforcement steps, due reviews, both passive and active tracks.
- **Add** — add one word or a batch, with auto-translation, duplicate detection by lemma, and a way to backfill missing translations on old entries.
- **Reading** — a short story generated from today's words (Groq, free tier), read aloud in-browser, with tap-to-translate on any word in context.

The interface language is English; the vocabulary data itself is Russian-to-English by design (that's the actual product — translating the UI chrome doesn't change what the app teaches).

## Why I built it

Personal project, for my own vocabulary practice. I'd noticed that isolated word↔translation flashcards trained recognition but didn't transfer to actually using the words — streak going up, retention not going up with it. My own real experience learning words was different: hit a word in a text, look it up, forget it, look it up again, and by the second or third pass it sticks on its own. That's retrieval practice in varied context, which is a stronger signal than drilling an isolated pair — so the reading mode exists specifically to reproduce that, not as a feature added for its own sake. It's also why reading practice deliberately does **not** feed the streak or move SRS dates on its own: if it did, it would recreate the exact problem it was built to solve.

## Why Notion, Not a Database

The word store is a Notion database, not Postgres or anything purpose-built — and that wasn't a "fastest way to get started" shortcut. It's a direct consequence of how this project actually began.

I didn't set out to build an app that calls an AI API at all. Early on, Claude had direct access to my Notion workspace, and the plan was for the intelligence layer to live *inside* Notion, not inside the app: Claude would fill in translations, write example sentences, and judge which words were better suited to passive recognition versus active production, directly on the Notion page. The app itself was meant to be nothing more than a spaced-repetition review surface on top of that — open it, pull whatever was already curated in Notion, review it. No LLM calls from the app's own code, because the LLM work already happened upstream, by hand, in Notion, before a word ever reached the review queue.

That's also why the Notion field mapping (`shared/config/app.ts`) has no word-suitability or curation field at all — the original design assumed that judgment call was made by a human (me, working with Claude directly in Notion) before the app ever saw the word. The app only ever needed to read `Слово`/`Определение`/`Транскрипция` and run SM-2 on top of them.

The scope grew from there, one good idea at a time rather than by plan: the dual passive/active tracks, streaks, the Telegram bot, and eventually the Groq-backed reading mode — the first and only place the app itself calls an LLM API — all got added incrementally, well after "just review words" was already working.

**A real gap this leaves today:** the app currently promotes *every* passively-learned word straight into active production practice — see `activeEligible` in `shared/lib/session.ts`, which is any word with status `Изучен пассивно`, `Выбран для активного изучения`, or `Изучен активно`, not learned today. There's no curation step deciding which words are actually worth the harder recall-with-no-hints practice — it's purely mechanical SRS-state promotion. That's a simplification from the original idea, where only words flagged as active-worthy would ever enter that track, and I haven't wired that judgment back in yet — see **What's Next** below.

**On scale:** `repository.ts`'s `listAll()` paginates the *entire* Notion database, 100 rows per request, sequentially, on every `/api/session` call — no caching. For a personal vocabulary list this is fine; Notion's API isn't fast, but it isn't the bottleneck at hundreds or even a couple thousand words. It would get progressively slower as the list grows, since it's O(n) Notion round-trips on every page load — a "the app gets sluggish before anything actually breaks" problem, not a wall it hits and stops at. I didn't plan for a huge word list when I picked Notion, and I still don't have one, so this hasn't mattered in practice.

## Tech Stack

```
Next.js 14 (App Router)
TypeScript (strict)
Tailwind CSS
Notion API           — word database + both SRS tracks
PostgreSQL (Neon) + Prisma — streaks and daily activity only, kept separate on purpose
Groq API (openai/gpt-oss-120b) — mini-reading story generation + contextual translation
Telegram Bot API + Vercel Cron — morning/evening study reminders
Web Speech API        — in-browser pronunciation, no paid TTS service
Vitest                — algorithmic core (SM-2, lemmatizer, dedup, streaks, queue building)
ESLint + Prettier + GitHub Actions CI
pnpm
```

No UI kit, no state-management library, no ORM beyond Prisma for the one Postgres table pair. Deliberately small dependency surface.

## Architecture

```
src/
├── app/            Next.js App Router — routes + API route handlers
├── screens/         page-level client components (Home, Study, Add, Reading)
├── entities/         typed domain models (word, session) — single source of truth
│                    for the /api/session response shape
└── shared/
    ├── config/      Notion field-name mapping + tunable limits (CAPS), one file
    ├── lib/         business logic: SM-2, lemmatizer, dedup, the Notion repository,
    │                streaks, Telegram, translation orchestration, Groq reading
    │                generation, offline queue, resilience wrappers
    └── ui/          small hand-rolled pieces (Icon, DuoButton, BackButton)
```

A few decisions worth calling out:

- **Notion as the word database**, behind a `WordsRepository` interface with one implementation. Swapping storage later means writing one new class and changing one line — the UI never touches Notion directly.
- **Streaks live in Postgres, not Notion** — on purpose. They're a different kind of data (derived activity log, not source-of-truth vocabulary) and don't need Notion's flexibility.
- **Everything fetches client-side from internal API routes** — no server-rendered data fetching. For a single-user personal tool this trade favors simplicity over the perf/SEO wins Server Components would normally buy; it wouldn't be the right call for a multi-user product.
- **This isn't textbook Feature-Sliced Design**, even though the layout borrows FSD's vocabulary (`entities`, `shared`). There's no `features` layer, and `screens` stands in for FSD's `pages`. Business logic that would live in per-feature folders under strict FSD sits flatly in `shared/lib` instead — which is closer to how I actually organize small Next.js apps than how I organize larger admin panels. I'd rather have an honest, slightly-informal structure than force full FSD onto an app this size.

## Built with Claude Code

Most of the implementation — the SM-2 engine, the Notion integration, the streak system, the Telegram bot, the reading feature, the redesign, and the cleanup pass described below — was written by Claude Code. I'm not going to pretend otherwise, and I don't think I should have to: the interesting part isn't whether I typed every line, it's whether I can direct an AI coding agent toward a working, coherent system and catch it when it's wrong.

What stayed mine throughout: the product decisions (dual-track SRS, why reading doesn't touch the streak, what "learned" means), the technical constraints (stay on Notion, stay free-tier, stay Next.js), reviewing what got built, finding what didn't hold up, and deciding what was worth fixing versus what was fine as-is.

## How I Worked With Claude Code

Not one long prompt — a sequence of scoped passes, each with a clear source of truth:

```
Requirements & constraints
        ↓
Implementation (Claude Code)
        ↓
Review — read the actual diff, run it, check the git history for how it evolved
        ↓
Failure analysis — what's genuinely wrong vs. what's just AI-generated-but-fine
        ↓
Correction — accept, reject, or redirect
        ↓
Validation — typecheck, tests, build, and (where it mattered) live behavior
```

The portfolio-prep pass that produced most of what's in this codebase today followed the same shape at a larger scale: research the existing app and my own older projects first (to extract a real, evidenced coding-style profile instead of guessing), audit for AI-generated over-engineering *and* under-engineering with file:line evidence, turn that into a prioritized fix list with an explicit risk/benefit per item, then work through it one item at a time with a full typecheck/test/build gate after each change before moving to the next.

One thing worth being specific about: partway through the research pass, I flagged what looked like a serious problem — Claude's own project-description document mentioned an AI-reading feature and a Duolingo-style redesign that didn't exist anywhere in the local checkout, which looked like documentation describing a feature that was never built. Turned out the local folder was just 11 commits behind `origin/main` — a forgotten `git pull`, not a fabricated feature. Caught by cross-checking `git log`/`git diff` against the remote before accepting the finding, not by assuming either the docs or the code was right.

## What Claude Got Wrong

Real issues found during the review pass, not hypothetical ones.

**1. Eleven `any` types in one screen, despite the exact type already existing.**
`StudyScreen.tsx` typed every study card as `w: any` in ~11 places. A `SessionCard` interface already existed in `entities/session/model.ts` — built specifically so a field rename would be caught by the compiler instead of failing at runtime — but this one file never used it. *Detected by:* static audit with file:line grep, not by a bug report. *Fixed by:* threading `SessionCard` through every function and component that touched a card.

**2. The one untested piece of business logic, buried in a `useEffect`.**
SM-2, the lemmatizer, dedup, and streak logic are all pure functions with their own test files. Lesson-queue assembly — deciding what order new words, same-day reinforcement, and due reviews appear in — was the one exception, written inline inside a `useEffect` in `StudyScreen.tsx` with no coverage. *Detected by:* noticing the inconsistency against the rest of the codebase's own testing discipline. *Fixed by:* extracting it to `shared/lib/studyQueue.ts` with 5 new tests covering chunking, ordering, and the divider-insertion rule.

**3. No retry on the one external call that had none.**
The Notion writes have retry-with-backoff. `translate.ts` runs three independent sources so one failing doesn't sink the others. The Groq-backed reading generation had neither — any transient 429 or 5xx immediately failed the whole request. *Detected by:* comparing resilience patterns across the codebase instead of assuming "it probably has the same discipline as everything else." *Fixed by:* one retry with the same backoff shape already used for Notion.

**4. Duplicated JSX that should have been caught during the redesign.**
The circular back-to-home button was byte-for-byte identical, copy-pasted, in two different screen files. Not a big deal on its own, but a sign the visual redesign pass didn't fully sweep for reuse opportunities it created. *Fixed by:* extracting a shared `BackButton`.

**5. Two different nonexistent filenames for the same missing file.**
`README.md` told a new clone to copy `.env.local.example`; `instructions.md` said `.env.example`. Neither file existed anywhere in the repo — a real onboarding dead end, and evidence that env-var documentation drifted across incremental sessions without anyone cross-checking both docs against each other. *Fixed by:* one real `.env.example`, with both docs pointed at it.

## My Role vs Claude's Role

| Area | Responsibility |
|---|---|
| Product idea & what "learned" means | Me |
| Requirements & constraints (Notion, free-tier, Next.js) | Me |
| Architecture | Me + Claude |
| Implementation | Primarily Claude Code |
| Code review & bug-finding | Me + Claude (audit passes), judgment calls — Me |
| Refactor prioritization | Me |
| Debugging (e.g. the Groq model-deprecation and empty-response fixes) | Me + Claude |
| Testing strategy | Me + Claude |
| Validation (typecheck/lint/test/build/manual) | Me + tooling |
| This README | Claude, under my direction and edit |

## What This Project Demonstrates

Technically: Next.js App Router conventions, TypeScript across a real (if small) domain model, a working spaced-repetition algorithm, resilience patterns around flaky third-party APIs, a from-scratch design system matched against an official brand reference, and a test suite that actually gates deploys instead of existing for show.

Process-wise: directing an AI coding agent through requirements → implementation → review → correction rather than accepting first-pass output, reading diffs and git history critically enough to catch real problems (and to *not* mistake a stale checkout for a documentation lie), and making deliberate scope calls — including declining to do things a more mechanical pass would have done (full-tree Prettier reformatting, forcing every screen onto one hook, wrapping every icon button in an abstraction) because the cost didn't justify the benefit.

## Limitations

This is a personal tool for one user, not a production application. No auth, no multi-tenancy, never load-tested, never had real traffic beyond me. Component-level UI isn't unit-tested — only the algorithmic core is (SM-2, lemmatizer, dedup, streaks, queue building); the Notion/Postgres/Groq/Telegram integrations are exercised by hand, not by CI, since that would mean shipping real credentials to a CI runner. The mini-reading feature needs your own free Groq API key — without one, the rest of the app works normally and only that one screen is unavailable.

## What's Next

Two things planned:

- **Migrate the word store off Notion** to a proper database once the list outgrows a full-table Notion sync on every page load (see the scale note above — no urgency yet, but the ceiling is real).
- **A daily cron job where a model picks which words graduate into active production practice**, restoring the curation judgment that today's mechanical "every passively-learned word eventually goes active" promotion replaced. Translation/example auto-fill is already solved without an LLM — `translate.ts` pulls from Google Translate, Tatoeba, and dictionaryapi.dev — so this is specifically about the one judgment call that was never automated at all: which words are actually worth active practice.

## Running It Yourself

Want to point this at your own Notion database instead of just reading the code? [SETUP.md](SETUP.md) has the full config: environment variables, Postgres (Neon) for streaks, and registering your own Telegram bot for reminders.
