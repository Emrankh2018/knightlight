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
| All gates | `node scripts/gates.mjs` (or `/gates`) |

## Hard rules
- No GPL/AGPL code: no chessground, no Stockfish. Use permissive licenses only.
- No copied content. All teaching text is original. Never scrape YouTube, Chessly, Chessable, chess.com or other copyrighted sites. Never use the names, likenesses or logos of Chessly or GothamChess/Levy Rozman.
- Never invent chess data (moves, openings, traps, facts). Doubtful items are left out and listed in `REVIEW_CHECKLIST.md`.
- Every course ships with `"reviewed": false` until the coach reviews it.
- `.cache/`, `node_modules/`, `dist/` and `.tmp/` are never committed.
- UI strings live only in `src/i18n/en.ts`.
- Games use Knightlight's default 8×8 chessboard and standard pieces. Show A–H and 1–8 only at the board edges. Keep empty squares clear and put game objectives and scores beside the board.
- Shipped puzzle data under `public/data/puzzles/` stays under 25 MB.
- Lichess data (CC0) is credited in the footer and README.

## Agent roster
Agent definitions live in `~/.claude/agents/` (generic) and `.claude/agents/` (project). Prompt copies for general-purpose fallback are in `docs/agent-prompts/`.
- `implementer`: builds one scoped task
- `test-engineer`: writes tests only; proves bugs with failing tests
- `code-reviewer`: read-only review and ship verdict
- `debugger`: diagnose-only; reproduces failures, proves the root cause, returns a HANDOFF block per root cause
- `release-engineer`: commits, CI, deploy verification
- `chess-content-author`: writes one course as annotated PGN
- `chess-fact-checker`: read-only chess verification of a course
- `classroom-ui-reviewer`: read-only projector/tablet UI review (contrast, board size, keyboard, touch targets, reduced motion, i18n strings, RTL-readiness)

## Delegation rules
- Building → `implementer`. After each milestone, `test-engineer` runs first, then `code-reviewer`.
- UI milestones: `classroom-ui-reviewer` after `code-reviewer`.
- Before writing e2e tests, exercise the UI with Playwright MCP.
- Use context7 for current docs on Vite 8, React 19, Tailwind 4, Vitest 5 and react-chessboard 5 before writing against their APIs.
- Course content → `chess-content-author` (one course per call), then `chess-fact-checker`. Fix every "wrong" or "fix first" item before committing.
- Commits, CI and deploy → `release-engineer`.
- The main session orchestrates, makes small edits itself, and re-runs the key checks before accepting any agent's report.

## Bugs: debugger → owner handoff
The `debugger` diagnoses and returns HANDOFF blocks; it never edits. Route each handoff by owner:

| Problem | Owner |
|---|---|
| Production code, data scripts (fix the script and regenerate with the `npm run data:*` script; never hand-edit `public/data`), lint errors in `src/`, UI/a11y/i18n violations, build/config | `implementer` |
| Test bug, flaky test, missing regression test, lint errors in `tests/` | `test-engineer` |
| Course content or PGN errors | `chess-content-author`, then `chess-fact-checker` |
| CI, git, deploy, Pages | `release-engineer` |

Dispatch rules:
- The main session reads each HANDOFF, sanity-checks any "the test is wrong" claim itself before dispatching, and resolves anything below high confidence first.
- It then dispatches each handoff to its owner with the block as the spec. Handoffs touching disjoint files may run in parallel; otherwise in order.
- After each fix: `test-engineer` confirms the regression test fails before and passes after (skip if `test-engineer` was the owner), `code-reviewer` reviews any non-trivial diff, then the gates run (`node scripts/gates.mjs`).
- Never skip, delete or loosen a test, and never add `eslint-disable` or relax a rule, to get green.
