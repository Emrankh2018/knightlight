# Test-engineer audit evidence — 2026-10-19

Audit only. No application or committed test changes, no installs/deploys/commits. Evidence directory: `.tmp/audit-2026-10-19/checks/`. Baseline HEAD supplied by coordinator: `cb4e991953a5c891d58f8d4863bfb35181051802`; intentionally dirty checkout.

## Results

| Check | Actual outcome | Exit | Raw evidence |
|---|---|---:|---|
| `node scripts/gates.mjs` | 1 failed gate: lint; all other gates pass | 1 | `gates.log`, `gates.exit` |
| Typecheck (inside gates) | PASS | 0 | `gates.log` |
| Lint (inside gates) | 1 error, 0 warnings | 1 | `gates.log` |
| Unit tests (inside gates) | 542 passed / 542 total; no failed or skipped tests reported | 0 | `gates.log` |
| Content validator | 8 courses, 30 chapters, 82 lessons, 246 steps, 0 issues | 0 | `gates.log` |
| Puzzle size gate | 2.80 MB, below 25 MB | — | `gates.log` |
| Review flags gate | 0/8 reviewed | — | `gates.log` |
| `npm run build` | 112 modules transformed; PWA 111 precache entries / 3546.75 KiB | 0 | `build.log`, timestamp/exit files |
| `npm run e2e -- --output=.tmp/audit-2026-10-19/checks/test-results --reporter=list` | 46 passed, 12 failed, 58 total; 4 workers; 3.8 minutes | 1 | `e2e.log`, `test-results/*/error-context.md` |
| Temporary production PWA/native-worker diagnostics | 6 recorded checks, all pass; see documented offline limitation below | 0 | `pwa-smoke.json`, `pwa-smoke.log` |
| Temporary production diagnostics for E2E failures | 5 behavior checks pass; 1 genuine geometry failure | 0 runner exit; per-check failure recorded | `failure-diagnostics.json`, `failure-diagnostics.log` |

Gates were completed before build; build completed before E2E; E2E completed before production smoke. Build ran 13:45:39–13:46:30 in UTC+03:00. The main gate runner intentionally suppresses successful child output; its reported unit count is preserved, but per-suite timing output is not available from that invocation.

## Confirmed findings

### P2: Lint failure in hardening test

- File: `tests/students-hardening.test.ts:115:14`.
- Error: `Unexpected control character(s) in regular expression: \x00` (`no-control-regex`).
- Reproduce: `npm run lint`, or the full gates command.
- Owner: test-engineer. Preserve the assertion's behavior while replacing its lint-invalid representation. Do not disable the rule or weaken the assertion.

### P1: Teacher Present controls extend below portrait viewport

- Reproduce at 820×1180: open `#/teacher`, click Present.
- Existing E2E assertion at `e2e/teacher.spec.ts:116` fails with scroll height 1221 against client height 1180.
- Independently reproduced on production preview: Exit Present rect y=1155.125, height=48, bottom=1203.125, exceeding viewport bottom 1180.
- Evidence: `teacher-present-portrait.png`, `failure-diagnostics.json`, and the Teacher E2E error context.
- Suspect responsible layout: `src/routes/Teacher.tsx` Present sizing and control/board layout. Owner: implementer. This is a product geometry defect, not a worker or machine-speed failure.

### P2: Existing E2E contracts lag current accessible roles and copy

11 of the 12 E2E failures stop before exercising the intended behavior. No test source was edited.

| Failing cases | Broken expectation | Current observed contract |
|---|---|---|
| `e2e/play.spec.ts:23` | `/Grandmaster Owl/` | `Wise Owl` |
| Play cases at lines 29, 37, 43, 53, 74, 82 | Helper line 8 requests `/Level 1: Sleepy Pawn/` | `Opponent 1: Sleepy Pawn …` |
| `e2e/students.spec.ts:14` | Line 22 requests avatar `role=button` | Avatar has `role=radio` and matching accessible name |
| `e2e/students.spec.ts:79` | Line 109 requests button `Reset progress` | `Yes, reset Player 1's progress` |
| `e2e/students.spec.ts:148` | Line 158 expects `Unsupported backup version` | `This backup came from a different version of Knightlight. Nothing was changed.` |
| `e2e/students.spec.ts:184` | Line 186 expects `Beginner (new to chess)` | `Solve Beginner puzzles about: Fork.` |

Current source `src/i18n/en.ts` and `src/components/students/StudentForm.tsx` agree with the observed DOM. Independent production diagnostics using the current controls verified White move plus bot reply (`1.e4 c6`), Black bot opening (`1.h4`), avatar selection and named reset, wrong-version import rejection retaining the profile, and assignment-to-puzzle navigation. The original failed Play cases time out while looking for the radio, before Start game, so they do not demonstrate a worker failure.

Owner: test-engineer, after coordinator confirms the UI changes represent accepted behavior. Repair test contracts; preserve behavioral assertions and expand no timeouts.

## Production PWA and worker proof

The temporary smoke used a clean Chromium context against `http://127.0.0.1:4174/knightlight/` served from the production build.

- A native `Worker` loaded `dist/assets/worker-*.js` as a module and returned `{id:1, uci:"f2f4", san:"f4"}` for the initial position at pawn difficulty. The harness had a native worker error handler; no worker error occurred.
- The production service worker controlled the page at `/knightlight/sw.js`; Workbox precache existed.
- With Playwright network offline, all 75 indexed puzzle buckets across 5 levels loaded, and row counts matched the index: 11,900 rows across buckets (not asserted to be unique puzzle IDs).
- Reloading the previously visited Italian lesson offline restored Step 1 and the board.
- The previously unvisited master mateIn2 puzzle route rendered offline.
- A previously unvisited Queen's Gambit course offline displayed `This course could not be loaded. All courses`. This is consistent with `vite.config.ts` caching courses/openings when first used. It does not prove all courses are available after one visit.
- No JavaScript page errors were emitted during the valid smoke or the six production behavior/geometry checks. These are functional observations, not a performance benchmark.

`pwa-smoke-stale-harness.*` preserves the first attempt, whose temporary exact text locator incorrectly required only `Step 1 of 3` despite the rendered suffix `· Explain`. That harness mistake was corrected only inside `.tmp`; final `pwa-smoke.*` is the valid completed run.

## Scope and remaining gaps

- Existing E2E config runs the Vite development server on port 5173 with default Chromium; it does not itself validate production SW behavior. The separate smoke above covers only selected production flows.
- No WebKit/Safari/iPad or Firefox runtime proof, real tablet touch/drag interaction, real projector rendering, screen-reader operation, physical keyboard focus feel, speaker output, or browser-specific storage quota/private-mode behavior.
- No service-worker upgrade across two deployments, interrupted update, old-tab/new-tab version transition, offline cache eviction/storage-pressure recovery, or cold first visit without network.
- No deployed live URL, deployed artifact hash, real host headers, CI run, or deployment verification was performed by this agent.
- Unit tests cover legal engine moves, mate and terminal states, worker-failure fallback via fake workers, SRS, XP, backup/date hardening, and whole-dataset content/puzzle legality. These do not replace native browser/runtime or chess-coach review.
- Course review flags remain false. Parser validation and legal-line checks do not constitute factual/pedagogical coach sign-off.
- A pre-existing Vite process had high accumulated CPU use and the machine was busy. Timings are not performance claims; failures above are attributed using concrete selectors/geometry, not elapsed wall time alone.

## Snapshot stability

SHA256 fingerprints cover 264 input files under `src`, `tests`, `e2e`, `scripts`, `content`, `public/data`, and key package/tool configuration files. Zero changes were observed from 13:45:09.406 to 13:52:43.208 UTC+03:00, spanning the latter gates phase, build, E2E, and production diagnostics. Evidence: `fingerprint-*.json` and `drift-*.log`.

This does not fingerprint the beginning of the gates command before 13:45:09, nor ignored build outputs. The original dirty checkout was preserved.
