# Progress

Resumable status. Update after every milestone.

## Session rules
- **Hard stop at 95% session usage** (user instruction, 2026-10-18): commit a checkpoint, update this file, then stop.
- **2026-10-18: the user stopped work and asked for a checkpoint.** All agents were stopped mid-task. The last commit is a WIP checkpoint (see status below).

## Done (verified)
- Step 0: agent prompts in `docs/agent-prompts/` (4 agent files blocked by the classifier; see DECISIONS.md), repo `AGENTS.md`/`CLAUDE.md`, generic `~/AGENTS.md` (backup `~/AGENTS.md.bak`).
- M0 scaffold. M1 PGN step format, parser, validator, AUTHORING.md, sample course. M2 openings index (3,865) and puzzle chunks (11,856 puzzles, 2.8 MB, all replay-validated).
- M3 core libs: engine (0x88 movegen passes perft on 6 positions; levels 1–5; worker), SRS, XP and streaks, achievements.
- UI foundation: stores (profiles, progress, settings, backup), data loaders, Board wrapper, Layout and nav, lazy routes, Home. Typecheck and build pass. **Not exercised in a browser yet.**

- 2026-10-19 tooling: all 7 agents installed, plus `classroom-ui-reviewer`; `debugger` is now diagnose-only with a HANDOFF to the owner (AGENTS.md). Project hooks (license guard, generated-data guard, lint on edit). `node scripts/gates.mjs` with `/gates` and `/checkpoint`. Playwright and context7 MCP servers (local scope).
- 2026-10-19 fixes: the 2 AUTHORING doc examples were missing `[LessonTitle]` (doc bug, fixed by implementer). The 2 lint errors were raw BOMs in template literals (escaped as `﻿` by test-engineer). Details are in DECISIONS.md.

## Status (2026-10-19, update)
- Puzzle trainer built and deployed at https://knightlight.omrankhammash.workers.dev via `npm run deploy:cloudflare`.
- 3 beginner courses authored, fact-checked and fixed; all `reviewed: false` (see REVIEW_CHECKLIST.md).
- Courses, Lesson, Teacher, Openings, Play, Review and Students routes are still placeholders and hidden from nav through `src/lib/ready-routes.ts`.
- Next: re-level puzzle ratings, sounds, openings/tactics.
- The older status and Next list below are historical (2026-10-18/19 morning).

## Status (2026-10-19, earlier)
`node scripts/gates.mjs`: all PASS. Typecheck, lint, 356/356 tests, validate:content (1 course, 0 issues), puzzle data 2.82 MB, 0/1 courses reviewed.
- **Partial, stopped mid-task:** the lesson player work. Present so far: `src/lib/lesson/` (findMove, hints, lineDrill, position), `src/components/lesson/` and `src/hooks/`. `src/routes/Lesson.tsx`, `Courses.tsx` and `Course.tsx` may still be placeholders or half-done, and `tests/lesson-machines.test.ts` is not written yet. Review all of it before continuing.

## Next (in order)
1. Apply the code-review findings (report from 2026-10-18; verdict "ship after fixes"):
   - **Blocker:** `src/lib/content/pgn.ts:60`. A tag named `__proto__`, `constructor` or `toString` crashes the parser. Use `Object.create(null)`/`Object.hasOwn` and add a test.
   - **Blocker:** `src/lib/content/parse.ts:55`. `errs.push(...game.errors)` overflows the stack on a huge error count. Loop instead, and cap at 50 errors per game.
   - `src/lib/xp.ts:50`: `levelFor` hangs for huge XP. Clamp it.
   - `src/lib/srs.ts`: the interval is unbounded, and NaN or corrupt values throw or produce garbage dates. Clamp to 1–365 days and sanitize.
   - `src/lib/xp.ts:67`: `updateStreak` throws on an invalid `lastDay`. Treat it as no previous day.
   - `src/engine/client.ts`: add a per-request timeout and a broken-worker flag; keep `moveSync` (and the engine) out of the client chunk.
   - Consider: sanitize `depth` in search.ts and clamp maxDepth; make openings search use AND-of-words and boost SAN queries; have the validator enforce `reviewed:false`; compute puzzle sizes before wiping the output; remove stale course JSON.
2. Finish the lesson player, Library and Course pages (spec in the stopped task; see PLAN.md M3/M5), with `tests/lesson-machines.test.ts`.
3. Then M4 Teacher Mode, the rest of M5 and M6, M7 content (author, then fact-check, one course at a time), M8 gates, M9 GitHub Pages.

## Known issues
- PNG app icons aren't generated yet (render with Playwright in M8).
- Engine: no repetition detection, so the bot may shuffle in won endings at L4–L5.
- The engine worker and client are unexercised in a browser.
