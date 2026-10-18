# Knightlight: project instructions

Knightlight is a static chess-teaching PWA for a coach (projected in class) and their students. It has no backend and no accounts. See `PLAN.md` for the approved plan, `PROGRESS.md` for current state, and `DECISIONS.md` for rationale.

## Stack and commands
| What | Tool / command |
|---|---|
| App | Vite 8 + React 19 + TypeScript 6 (strict) + Tailwind 4; HashRouter; zustand 5 |
| Rules / board | chess.js (BSD-2) / react-chessboard (MIT) |
| Offline | vite-plugin-pwa |
| Dev server | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` (Vitest) |
| E2E | `npm run e2e` (Playwright) |
| Content validator | `npm run validate:content` |
| Data build | `npm run data:openings`, `npm run data:puzzles` (downloads to `.cache/`) |
| Production build | `npm run build` then `npm run preview` |

## Hard rules
- No GPL/AGPL code: no chessground, no Stockfish. Use permissive licenses only.
- No copied content. All teaching text is original. Never scrape YouTube, Chessly, Chessable, chess.com or other copyrighted sites. Never use the names, likenesses or logos of Chessly or GothamChess/Levy Rozman.
- Never invent chess data (moves, openings, traps, facts). Doubtful items are left out and listed in `REVIEW_CHECKLIST.md`.
- Every course ships with `"reviewed": false` until the coach reviews it.
- `.cache/`, `node_modules/`, `dist/` and `.tmp/` are never committed.
- UI strings live only in `src/i18n/en.ts`.
- Shipped puzzle data under `public/data/puzzles/` stays under 25 MB.
- Lichess data (CC0) is credited in the footer and README.

## Agent roster
Agent definitions live in `~/.claude/agents/` (generic) and `.claude/agents/` (project). Prompt copies for general-purpose fallback are in `docs/agent-prompts/`.
- `implementer`: builds one scoped task
- `test-engineer`: writes tests only; proves bugs with failing tests
- `code-reviewer`: read-only review and ship verdict
- `debugger`: root-causes failures, minimal fix and regression test
- `release-engineer`: commits, CI, deploy verification
- `chess-content-author`: writes one course as annotated PGN
- `chess-fact-checker`: read-only chess verification of a course

## Delegation rules
- Building → `implementer`. After each milestone, `test-engineer` runs first, then `code-reviewer`.
- Bugs → `debugger`.
- Course content → `chess-content-author` (one course per call), then `chess-fact-checker`. Fix every "wrong" or "fix first" item before committing.
- Commits, CI and deploy → `release-engineer`.
- The main session orchestrates, makes small edits itself, and re-runs the key checks before accepting any agent's report.
