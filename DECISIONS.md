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
- **Puzzle levels are inclusive integer ranges:** 0–999, 1000–1399, 1400–1799, 1800–2199, 2200+. The sampling seed is 20261018.

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
- **MCP servers** (local scope in `~/.claude.json`, not committed): Playwright (`npx @playwright/mcp@latest`) to exercise the never-browser-tested UI before e2e tests, and context7 (`npx -y @upstash/context7-mcp`) for current docs on the new major versions in the stack.
