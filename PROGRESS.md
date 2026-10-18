# Progress

Resumable status. Update after every milestone.

## Session rule
- **Hard stop at 95% session usage** (user instruction, 2026-10-18). On reaching it, write a checkpoint (commit verified work and update this file) and stop.

## Done
- Step 0: agent prompts in `docs/agent-prompts/` (see DECISIONS.md for the 4 agent files the classifier blocked), repo `AGENTS.md`/`CLAUDE.md`, generic `~/AGENTS.md` (backup at `~/AGENTS.md.bak`).
- M0: scaffold (Vite 8 + React 19 + TS strict + Tailwind 4 + PWA), i18n file, content model types, layout shell.
- M1: PGN step format, parser and validator (`src/lib/content/`), `npm run validate:content`, `npm run data:content`, docs/AUTHORING.md, sample course.
- M2: openings index (3,865 openings, 7,983 positions) and puzzle pipeline. 75 chunks, 2.8 MB, 0 invalid. Built from real Lichess data.
- M3 (partial): in-house engine (0x88 movegen with perft checks, alpha-beta, levels 1–5, worker), SRS, XP and streaks, achievements.
- Checkpoint commit verified at that point: typecheck, lint and 200/200 tests passing, validator 0 issues.

## In flight when the checkpoint was taken (uncommitted, not yet verified)
- test-engineer: hardening the tests for the core libs (`tests/`).
- code-reviewer: reviewing M1, M2 and M3 core (findings still pending, so fix them before the next commit).
- implementer: UI foundation, still uncommitted. Covers `src/store/`, `src/lib/data.ts`, `src/lib/describe.ts`, the Board/Ring/Button/Toasts/ThemeToggle/ProfileSwitcher/SearchSlot components, the route placeholders, and changes to App/Layout/Home/i18n/index.css.

## Next
1. Apply the review fixes, re-run all checks, and commit the M3 core plus the UI foundation.
2. Lesson player (4 step types, hint ladder, keyboard), then Library and Course pages.
3. Teacher Mode (analysis board, opening naming, Ctrl+K search, present view, notes).
4. Puzzles plus Class Mode, Play-vs-bot, Review queue, Repertoire, Explorer, Students/leaderboard/backup/assign links.
5. M7 content (one course per author agent, then fact-check), M8 quality gates, M9 GitHub Pages.

## Known issues
- PNG app icons aren't generated yet (render them with Playwright in M8).
- Engine: no repetition detection, so the bot may dawdle in won endgames at L4–L5.
- The engine worker and client are type-checked only and haven't been run in a browser yet.
