# Decisions

Dated log (Asia/Qatar). Newest last.

## 2026-10-18
- **Name and brand: "Knightlight".** The logo is an original knight head inside a crescent of light (`public/favicon.svg`). Palette: ink-teal `#0F3D3E`, amber `#F2A541`, cream `#FFF8EC`, coral `#E4572E` (errors), leaf `#3BB273` (success). No third-party names, likenesses or assets.
- **Stack versions moved past the plan's "React 18 / Tailwind 3".** Current stable versions are React 19.3, Tailwind 4.3, Vite 8.3 and Vitest 5. react-chessboard 5.x requires React 19, so the newer versions are the natural choice.
- **TypeScript 6.0.3, not 7.0.** typescript-eslint 8.71 supports TS `<6.1`, and lint must stay clean.
- **Puzzle CSV schema changed.** It now has an 11th column, `DailyDate`, after `OpeningTags` (checked on database.lichess.org on 2026-10-18). The pipeline reads columns by header name and ignores unknown ones.
- **Openings repo:** the root `a.tsv`–`e.tsv` files carry only `eco`, `name` and `pgn`. `uci` and `epd` exist only in the generated `dist/`, so the build script derives them with chess.js.
- **No system `zstd`.** Decompression uses the `fzstd` npm package (MIT) in streaming mode.
- **Content format: one PGN game = one step.** Consecutive games sharing `[Lesson]` form a lesson. This keeps the files standard PGN. See docs/AUTHORING.md.
- **Agent setup partly blocked.** The Claude Code permission classifier denied writing four agent definition files: `~/.claude/agents/debugger.md`, `~/.claude/agents/release-engineer.md`, `.claude/agents/chess-content-author.md` and `.claude/agents/chess-fact-checker.md`. `implementer`, `test-engineer` and `code-reviewer` were written. Custom agents also don't load mid-session. All seven bodies are kept in `docs/agent-prompts/` and run as general-purpose subagents with that body as the prompt, per plan amendment Step E.
- **esbuild install script approved** (`npm install-scripts approve esbuild`). tsx and Vite need its native binary.
- **XP values beyond the plan:** puzzle with hint 10, line with mistakes 15, lesson bonus 25, streak bonus 5. XP is awarded only the first time a step, puzzle or lesson is completed, so repeats can't farm it.
- **Level curve:** `xpForLevel(n) = 100·n·(n−1)/2`, so level 1 starts at 0 XP, level 2 at 100 and level 3 at 300. This is the plan's formula shifted by one, so that new players start at level 1.
- **Puzzle buckets:** a puzzle appears in every main-theme bucket it is tagged with, plus mixed. "Main theme" means a curated list of 14 themes, not one primary theme per puzzle.
- **Puzzle levels are inclusive integer ranges:** 0–999, 1000–1399, 1400–1799, 1800–2199, 2200+. The sampling seed is 20261018. (Superseded 2026-10-19, see below.)

## 2026-10-19 (puzzle re-levelling)
- **Puzzle bands lowered for children:** beginner 0–699, intermediate 700–1199, mid-advanced 1200–1599, advanced 1600–1999, master 2000–4000 (inclusive). Level ids are unchanged. Why: the coach teaches children new to chess and the old 0–999 beginner band was too hard (Lichess puzzle ratings effectively start near 400).
- **Looser filters for beginner only:** popularity >= 60, plays >= 100, rating deviation <= 110 (other levels keep 90 / 500 / 90). With the strict filters, beginner pin had 61 puzzles, deflection 30, attraction 20 and trappedPiece 2. With the looser ones every beginner theme has >= 50. Data is still Lichess CC0 (credit kept in footer and README); total size 2.8 MB, far under 25 MB.

## 2026-10-19
- **Agent setup completed.** The four agents blocked on 2026-10-18 now exist: `debugger` and `release-engineer` in `~/.claude/agents/`, `chess-content-author` and `chess-fact-checker` in `.claude/agents/`. The classifier blocked no writes this time. `docs/agent-prompts/` keeps the copies used for general-purpose fallback.
- **`debugger` is now diagnose-only** (tools Read, Glob, Grep, Bash; repro scripts only under `.tmp/`). It returns one HANDOFF block per root cause, and the main session dispatches it to the owner (routing table in AGENTS.md). Why: keeps diagnosis and fixing separate, so each fix goes to the agent whose file rules fit it (for example, test-engineer never touches production code). `implementer` and `test-engineer` gained a "When given a debugger HANDOFF" section. The same rule was added to the generic `~/AGENTS.md`; its pre-change copy is `~/AGENTS.md.2026-10-19.bak` (the older `~/AGENTS.md.bak` was kept, not overwritten).
- **`classroom-ui-reviewer`** (project agent, read-only, sonnet). Why: the app is projected in class and used on tablets; this checks contrast, board size at 1366×768 and 1024×768, keyboard focus, 44 px targets, reduced motion, strings from `src/i18n/en.ts` and RTL-ready logical classes. No lint rule enforces those.
- **Project hooks** in `.claude/settings.json`, logic in Node scripts under `.claude/hooks/` (no jq; works on Windows):
  - `license-guard.mjs` (PreToolUse Bash and Edit|Write): blocks installing or adding chessground/stockfish packages. Why: hard rule "no GPL/AGPL".
  - `protect-data.mjs` (PreToolUse Edit|Write): blocks hand edits to `public/data/`, `.cache/`, `dist/`. Why: generated output must come from the `data:*` scripts.
  - `lint-edited.mjs` (PostToolUse Edit|Write): runs eslint on an edited `.ts`/`.tsx` file in `src/`, `tests/` or `scripts/`. Why: lint errors reached the last checkpoint. No tsc per edit (too slow); the gates run it.
  - All three were tested by piping sample hook JSON (19 cases, all as expected).
- **`scripts/gates.mjs` with `/gates` and `/checkpoint` skills** (user-invoked only). Why: one repeatable check before accepting agent work or committing. A course with `"reviewed": true` is a WARN, not a FAIL, because the coach signs courses off over time.
- **First debugger → owner run.** The new agents aren't loadable mid-session, so the four diagnoses ran as general-purpose subagents with the `debugger` agent body as the prompt. The owners (`implementer`, `test-engineer`) were already loaded and ran as themselves.
  1. `tests/authoring-doc.test.ts`, find-move example (line 141). Root cause: `docs/AUTHORING.md` (find-move block) had no `[LessonTitle]`, but it is the first game of its lesson, and the spec (AUTHORING.md:75) requires one. The parser and the strict test were right; the doc was wrong. Owner: `implementer`. Added `[LessonTitle "Attacking f7"]`.
  2. Same test, quiz example (line 177). Same root cause. Owner: `implementer`. Added `[LessonTitle "The knight fork"]`.
  3. Lint `tests/content-edge.test.ts:50:40`. Root cause: a raw U+FEFF (BOM) inside a template literal. ESLint's `no-irregular-whitespace` checks template literals but skips plain strings. The BOM is deliberate test input. Owner: `test-engineer`. Replaced it with the `﻿` escape; the runtime string is identical, and with the escape removed both BOM tests failed.
  4. Lint `tests/content-edge.test.ts:59:41`. Same root cause and fix. Owner: `test-engineer`.
  - No `eslint-disable` comments, no rule changes, no tests loosened. Lines 53 and 67 still hold raw BOMs in single-quoted strings. Lint ignores them, but an editor could silently strip them; noted as a risk.
  - Doc fix verified by the main session: 2 failed with the old doc, 29/29 pass with the new one. `code-reviewer` was skipped because both diffs are 2-line edits.
- **MCP servers** (local scope in `~/.claude.json`, not committed): Playwright (`npx @playwright/mcp@latest`) to exercise the never-browser-tested UI before e2e tests, and context7 (`npx -y @upstash/context7-mcp`) for current docs on the new major versions in the stack.
- **Sound defaults to ON; saved mute is kept.** The default flipped from muted to on. Profiles that already saved settings with `sound:false` and a `volume` stay muted until the speaker is clicked. Settings saved before `volume` existed (no `volume` key) were written when muted was the default, so `validateSettings` treats them as the new default ON (covered in `tests/sound.test.ts`). Audio hardening: any non-`running` context state (Safari/iOS `interrupted`) is resumed in `unlockAudio` and `playSound`, a `closed` context is recreated, and `setVolume` ignores non-finite values so a bad value cannot invalidate and reset all settings. The volume slider announces a percentage (`aria-valuetext`) and previews a sound (debounced) after keyboard changes.

## 2026-10-19 (puzzle mixed buckets)
- **Mixed buckets are now interleaved across themes.** Before, one reservoir fed `<level>/mixed`, so beginner mixed was ~88% mate puzzles (mateIn1 alone 60%), which is dull for children. Now `scripts/build-puzzles.ts` keeps one mixed reservoir per main theme (plus "other" for puzzles with none), each capped at 25% of `PER_MIXED_LEVEL` (75); because puzzles carry several tags (endgame co-occurs with many mates), the interleave also skips a puzzle once any main tag already appears in 35% of the bucket. Each puzzle joins the least-filled matching theme's reservoir, and the final 300 are taken round-robin across the reservoirs. Same seed, deterministic.
- **`index.json` `filters.beginner`** now records the beginner level's effective filters (60 / 100 / 110) next to the strict defaults (90 / 500 / 90). `PuzzleIndex` in `src/lib/puzzle-types.ts` gained the field. Tests assert each mixed bucket has >= 250 puzzles and no main theme above 40%.

## 2026-10-27 (lamplit study visual direction)
- **Direction: "lamplit study"** (owner approved): warm dark ink-teal with an amber glow; cream paper in light mode. Roadmap and audit in `UPGRADE_ROADMAP.md`.
- **Fonts self-hosted (OFL):** Fraunces (display, h1 and `.kl-display`) and Nunito (text), latin subset only, via `@fontsource-variable/*` files referenced from `src/index.css`. Before this the CSS named Nunito but never loaded it. Cost: about +81 KiB precache (3,541 to 3,623 KiB).
- **Tokens:** radius scale (`rounded-control/card/hero`), warm shadow scale (`shadow-card/lift/glow`), `ink-deep` and `lamp` colours, a page-top lamp glow. Amber stays the primary-action colour; amber text is never used on cream (1.94:1).
- **Icons:** original stroke SVGs in `src/components/icons.tsx` replace the emoji in the header and the streak flame.
- **Avatars keep the stored emoji value** (profiles, backups and leaderboards validate against `AVATARS`), rendered through `src/components/Avatar.tsx` in a consistent badge. Original SVG avatar art is deferred; swap it inside `Avatar` without changing saved data.
- **Piece set:** deferred to Phase 2. Must be original or licence-verified permissive; record the licence here first.
