# Plan: "Knightlight": chess teaching assistant (static PWA)

## Context
The user is a chess coach who teaches kids and beginners. They want an original, interactive chess-learning site in the style of Chessly. It must run as a static site and serve two uses: projected in class, where Teacher Mode is the priority, and self-study by students. `C:\Users\welcome\Desktop\mychess` is empty and is not a git repo. The root `C:\Users\welcome\AGENTS.md` applies only to JARVIS work, so it doesn't apply here. Toolchain: Node 26.8, npm 11.19, git 2.54, and gh 2.100, already logged in as `Emrankh2018`, so Phase 6 can run without blocking.

Data sources, checked during planning:
- Lichess puzzles: `https://database.lichess.org/lichess_db_puzzle.csv.zst`, CC0, about 6.16M rows. **Schema change:** the file has a new 11th column, `DailyDate`. The parser reads columns by header name and ignores unknown ones. Log this in DECISIONS.md.
- Lichess openings: `a.tsv`–`e.tsv` with columns `eco`, `name`, `pgn` at the repo root (CC0). The `uci` and `epd` columns exist only in `dist/`, so I'll derive them myself with chess.js.

## Key decisions (all to be logged in DECISIONS.md)
- **Name/brand:** "Knightlight". The logo is an original SVG of a knight's head inside a crescent of light. Palette: deep ink-teal `#0F3D3E`, warm amber `#F2A541`, cream `#FFF8EC`, coral `#E4572E` for errors, green `#3BB273` for success. Before creating the repo, I'll check with `gh repo view` that the name is free; if it's taken I'll fall back to `knightlight-chess`.
- **Stack:**
  - Vite + React 18 + TypeScript (strict) + Tailwind 3.
  - chess.js (BSD-2) for the rules.
  - **react-chessboard (MIT)**, version pinned.
  - zustand (MIT) for state, react-router `HashRouter`. Hash routing works on GitHub Pages and lets share links live in the hash.
  - vite-plugin-pwa (MIT) for offline use.
  - Vitest, ESLint (flat config), Playwright for browser checks, and Lighthouse CLI.
  - No GPL code anywhere.
- **zstd decompression:** use the system `zstd` binary if it's installed, otherwise stream through the `fzstd` npm package (MIT). The raw download is cached in `.cache/`, which is gitignored and never committed.
- **Content format:** one PGN *game* = one *step*. A lesson is the run of consecutive games that share a `[Lesson "id"]` tag. Each chapter `.pgn` file holds several lessons. This keeps everything standard PGN, so chess.js can parse every game.
  - Tags:
    - `[Step "explain|find-move|line-drill|quiz"]`, `[Lesson]`, `[LessonTitle]`, `[FEN]`, `[Side]`
    - `[Hint "..."]`, which can repeat
    - `[TeacherNotes "..."]`, `[Mistakes "..."]`, `[ClassQuestions "a | b"]`
    - `[Question]`, `[Choices "a | b | c"]`, `[Answer "1"]`
  - Movetext comments carry `[%cal]`, `[%csl]` and the explanation text.
  - How each step type reads its movetext:
    - **find-move:** the first move is the solution. Later moves alternate between the opponent's reply and the next solution move.
    - **line-drill:** the main line. `[Side]` sets which side the student plays.
    - **explain:** moves you step through, with a comment on each.
  - I'll write my own small PGN tokenizer for tags, comments and annotations. Every move is still replayed and checked in chess.js.
- **Spaced repetition:** a simplified SM-2. Each item has ease, interval and due date. A failure resets the interval to 1 day; a success multiplies it by the ease. Items are drilled lines and missed puzzles.
- **XP and levels:**
  - XP: 10 per step solved, 5 if a hint was used, 20 per puzzle, 30 per drilled line.
  - Levels: level n needs 100·n·(n+1)/2 total XP.
  - Streak: counted per calendar day in the device's local timezone.
- **Persistence:** localStorage, one versioned key per profile, plus a key for the profile list. Export and import move everything as one JSON file.
- **Assign links:** `#/assign?type=lesson&id=...` or `#/assign?type=puzzles&level=..&theme=..`.

## Repo layout
```
content/courses/<slug>/course.json + NN-chapter.pgn
scripts/  build-puzzles.ts, build-openings.ts, build-content.ts, validate-content.ts (tsx)
public/data/puzzles/<level>/<theme>.json, mixed.json, index.json
public/data/openings/openings.json (+ positions map keyed by EPD)
src/
  i18n/en.ts            all UI strings (t() helper, dir="ltr" ready for RTL)
  lib/pgn/              tokenizer, parser -> Course/Lesson/Step types, validator (shared by CLI + tests)
  lib/openings.ts       EPD lookup -> longest named opening + continuations
  lib/puzzles.ts        lazy chunk loader, solve-state machine (auto-play Moves[0], any mate on final move)
  lib/srs.ts, lib/xp.ts, lib/achievements.ts
  engine/               search.ts (alpha-beta + quiescence + PST, iterative deepening), worker.ts, levels 1-5
  store/                profiles, progress, settings (zustand + persist)
  components/           Board wrapper (arrows/highlights/click+drag), HintLadder, Ring, SearchPalette, PresentView
  routes/               Home, Library, Course, LessonPlayer, Teacher(Analysis), Puzzles, Repertoire, Explorer, Play, Review, Profiles, Leaderboard, Assign
tests/                  vitest suites
e2e/                    playwright smoke at 1366x768 and 1024x768/768x1024
docs/AUTHORING.md, README.md, DECISIONS.md, PROGRESS.md, REVIEW_CHECKLIST.md, LICENSE (MIT)
.github/workflows/pages.yml
```

## Milestones (commit after each, update PROGRESS.md each time)
- **M0 Plan + scaffold.**
  - `git init`, Vite React-TS, Tailwind, ESLint, Vitest.
  - Write PROGRESS.md, DECISIONS.md, the i18n file, `.gitignore` (node_modules, dist, .cache), and the MIT LICENSE.
- **M1 Content format.**
  - PGN tokenizer, parser and validator, plus the `npm run validate:content` CLI.
  - docs/AUTHORING.md, a sample course, and parser/validator unit tests, including cases that must fail.
- **M2 Data pipeline.**
  - **Openings:** fetch the TSVs, replay them with chess.js, and emit `openings.json` (eco, name, pgn, uci, epd) plus a positions map keyed by EPD (opening id plus child continuations).
  - **Puzzles:** stream download → zstd → line-by-line CSV. Filter on Popularity ≥90, NbPlays ≥500, RD ≤90. Bucket by level × main theme with seeded reservoir sampling (150 per bucket, 300 mixed per level).
  - Main themes: mateIn1, mateIn2, mateIn3, fork, pin, skewer, hangingPiece, discoveredAttack, deflection, attraction, backRankMate, endgame, sacrifice, trappedPiece.
  - Commit the JSON output, which should come to roughly 3–6 MB, well under the 25 MB limit.
- **M3 Core engine.**
  - Board wrapper and the lesson player with all 4 step types.
  - Hint ladder (piece → square → move), wrong-move feedback, keyboard navigation (←/→, h for hint, Enter).
  - Bot worker with levels 1–5. Level 1 is depth 1, and 35% of the time it plays a random legal move instead of the best one, so it blunders the way a young beginner does. It still takes a mate in one when it has one.
  - Stores, SRS, XP, achievements, plus unit tests for SRS, XP and streaks.
- **M4 Teacher Mode** (first among features):
  - Fullscreen Present view with big type and a high-contrast theme.
  - Analysis board: undo, flip, reset, FEN/PGN load and copy, live opening name and continuations.
  - Ctrl/Cmd+K search over openings (name, ECO, moves) and over lessons and chapters.
  - Teacher Notes panel, and coach-controlled reveal (hidden → hint → solution).
- **M5 Library + Repertoire + Puzzles + Explorer + Play.** Catalog with filters and progress rings, plus "continue". Repertoire trainer that feeds mistakes into SRS. Puzzle trainer with level and theme, streaks and Class Mode. Explorer browsable by A–E. Play-vs-bot, and a Review queue page.
- **M6 Classroom.** Profiles with name and avatar (emoji set), a local leaderboard, JSON export/import, assign links, dark/light themes, and an a11y pass (aria labels, focus rings, board square labels).
- **M7 Starter content.**
  - All 8 skills courses and 14 opening courses, in conservative, original, plain language.
  - I'll prefer fewer lessons where I'm not certain. Every line must pass the validator, and all courses ship with `reviewed:false`.
  - REVIEW_CHECKLIST.md lists every course, chapter and lesson with checkboxes.
- **M8 Quality gates.**
  - Vitest:
    - all content
    - every puzzle chunk (valid FEN, legal UCI sequence, mate-tagged puzzles end in checkmate)
    - 20 known opening sequences return the right name (for example 1.e4 e5 2.Nf3 Nc6 3.Bb5 → Ruy Lopez), checked against the TSV
    - SRS and XP
  - `tsc --noEmit`, ESLint, and `vite build`.
  - Playwright smoke tests at laptop and tablet widths; fix whatever breaks.
  - Lighthouse on `vite preview` for Home, Library, Lesson and Puzzles, aiming for ≥90 performance and accessibility.
- **M9 GitHub.**
  - `gh repo create knightlight --public --source=. --push`.
  - Pages workflow (`actions/deploy-pages`), with `base: '/knightlight/'` in Vite.
  - Enable Pages through `gh api -X POST repos/{owner}/knightlight/pages -f build_type=workflow`.
  - Watch the run and confirm the live URL loads.
  - README with screenshots taken by Playwright.
- **M10 Wrap-up.**
  - Final summary.
  - Short dated notes in AI-Claude-Brain and AI-Shared-Brain (project note plus `Handoffs/2026-10-18-claude-knightlight-build.md`), and add the project to AI-Knowledge PROJECT-INDEX if appropriate. Reread each note before writing and never include secrets.

## Risks / mitigations
- **Puzzle download size** (several hundred MB): stream it and never hold rows in memory. If the download fails I'll retry; as a last resort I'd use a partial stream and log that in DECISIONS.md.
- **Chess accuracy of written content:** every position and move is machine-checked. Explanatory claims stay simple and well known, and anything doubtful is left out and flagged in REVIEW_CHECKLIST.
- **The in-house engine is weak at depth:** that's acceptable for a beginners' class. Depth is capped by level, and there's a time budget per move.
- **react-chessboard API version differences:** pin the version and wrap it in a single `Board` component.

## Verification
- `npm run validate:content`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`: all must pass.
- `npm run e2e` (Playwright) at 1366×768 and 820×1180: library → lesson → find-move solved → puzzle solved → teacher analysis names "Italian Game" after 1.e4 e5 2.Nf3 Nc6 3.Bc4 → Ctrl+K search → present view.
- Lighthouse reports saved under `.tmp/lighthouse/`, which is gitignored, with scores written into PROGRESS.md.
- Live Pages URL fetched after deploy; the GitHub Actions run is green.

## Approved amendments (user, 2026-10-18)
1. Save this plan as PLAN.md in the repo root first.
2. M10 vault notes are optional and come last, only after the live URL is verified. Reread each note before writing; no secrets.
3. Build with subagents. In M7, delegate one course per call, then fact-check it.
4. **Step 0 (before M0):**
   - A. Write 5 user-level agents in `C:\Users\welcome\.claude\agents\`: implementer, test-engineer, code-reviewer, debugger, release-engineer. All sonnet, with full bodies written from the user's specs.
   - B. Back up `C:\Users\welcome\AGENTS.md` to `AGENTS.md.bak`, then rewrite it as a generic operating guide covering the roster, delegation rules, milestone loop, handoff files and hard rules. The user authorized this.
   - C. Write 2 project agents in `.claude/agents/`: chess-content-author (sonnet) and chess-fact-checker (opus, read-only).
   - D. Create a repo `AGENTS.md` (stack and commands table, hard rules, roster, delegation rules) and a `CLAUDE.md` containing exactly `@AGENTS.md`.
   - E. Verify all 7 agent files and their front-matter. If the new agents can't be loaded this session, use general-purpose agents with the agent file's body as the prompt, and log that in DECISIONS.md.
5. Milestone loop: implementer builds → checks → test-engineer → code-reviewer → fixes → release-engineer commits → update PROGRESS.md.
