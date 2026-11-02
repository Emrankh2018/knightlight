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

## RESUME HERE (updated 2026-10-19 after redeploy)
Live and verified: https://knightlight.omrankhammash.workers.dev (deploy with `npm run deploy:cloudflare`; wrangler login already done). Committed: puzzle trainer, re-levelled bands (beginner 0-699, intermediate 700-1199, mid-advanced 1200-1599, advanced 1600-1999, master 2000+), balanced mixed sets, synthesized sounds (mute+volume), Class Mode fit fix + e2e. Stop at 95% usage; checkpoint at 90%.
Next (user priorities: puzzles, tactics, openings first; courses later):
1. DONE and live (2026-10-19): Tactics hub (#/tactics) and Openings explorer (#/openings), board is a single tab stop. Coach to confirm the ECO group titles (REVIEW_CHECKLIST.md).
2. DONE and live: Courses library, Course page, Lesson player (4 step types, Present mode, Teacher view). Review page DONE and live (SRS for missed puzzles and drill lines). Next: Teacher/analysis page, Play vs bot, then intermediate courses. Optional hardening: stale-ply on same-task key bursts in src/components/lesson/shared.tsx useControls/useKeys (not user-reachable).
3. After each: gates, e2e, debugger/code-reviewer, commit, redeploy, live smoke test.
4. Then Courses/Lesson pages, then intermediate courses (author -> fact-check -> fix; reviewed:false).
5. /graphify was requested by the user: run when idle (graphify-out/ is gitignored).
Known: reload mid-set restarts the set; Review page is a placeholder; sound untested on real speakers/iPad.

## Status (2026-10-19 audit checkpoint; user requested stop)

- Audit findings and resume backlog saved in `AUDIT_REPORT.md`; permanent evidence in `docs/audits/2026-10-19/evidence/`. This is the latest audit snapshot; older implementation/deployment statements above are historical.
- Verified in this session: typecheck PASS; lint FAIL (one `no-control-regex` at `tests/students-hardening.test.ts:115`); 542/542 unit tests PASS; validator 8 courses/30 chapters/82 lessons/246 steps/0 issues; puzzles 2.80 MiB; 0/8 courses reviewed. Full gates exit 1.
- Production build PASS. Existing E2E: 46 passed/12 failed; 11 stale UI expectations and one reproduced Teacher Present geometry defect. Independent current-control production checks passed bot play, student reset/avatar, invalid import rejection and assignment navigation.
- Native production Worker and service worker exercised in Chromium; all 75 puzzle buckets available offline after initial precache, visited lesson reload works. Physical iPad/projector/audio and two-version SW updates remain unverified.
- Two P1 findings: quota-failed backup import can lose the original roster; accepted huge XP can hang the UI. Additional data integrity/parser/UI/accessibility/pipeline/test findings have stable IDs and owner/acceptance specs in the report. No fixes applied.
- User asked for a checkpoint and stop, then explicitly requested a shared Obsidian handoff for Claude. Saved one-time handoff in `AI-Shared-Brain/Handoffs/2026-10-19-codex-knightlight-audit-checkpoint.md`; no automatic sync or message to another chat.
- Existing dirty source/content/tests preserved; no staging, commit, push or deployment. Gates were not rerun after the stop request; completed evidence is retained. Work stopped.

## Next (audit handoff; only after the user resumes)

1. Read `AUDIT_REPORT.md`, current instructions and the source fingerprint before selecting work. Reproduce AUD-01/AUD-02 and fix via the owner/test/review workflow.
2. Follow the report's prioritized backlog; preserve generated-data and coach-review rules. Resolve the Play credit contract before changing assertions.
3. Run complete gates/build/E2E and affected production checks after repairs. A future release needs authorization and separate live-artifact verification.

## 2026-11-02: Teacher position editor (implementation and QA complete)

- The owner rejected the earlier five-upgrade proposal and selected direct board setup on Teacher instead. Commit, GitHub push and Cloudflare deployment are authorized after verification.
- Teacher now offers **Set up position**: clear/start board, all 12 pieces, direct placement/removal, unrestricted desktop dragging, side to move, castling rights, board flip and keyboard editing. Drafts remain separate until **Use this position**; Cancel/Escape preserve the analysis and notes.
- Apply validates kings, pawns, king separation and check state before creating a new analysis root. Reset returns to that setup; Black-to-move move numbering is correct. Existing pieces/themes are reused; no dependency or generated-content change.
- Regression fixes: opening the editor no longer scrolls past the board on phones; keyboard focus uses a contrasting color on each square. Both failures were demonstrated before their fixes and passed afterward.
- Verification: 567 unit tests; full gates; root-path production build; 68/68 production-preview E2E with one worker, zero retries and unchanged timeouts. Network-mock tests block service workers, matching development behavior. Main separately verified the real service worker, offline reload/placement/Apply/Present, custom castling and responsive layouts. Code and classroom reviews: ship.
- E2E fixture repair: the existing oversized import test now loads the identical 5,242,890-byte file from disk rather than sending its buffer through browser automation; all original rejection/data-preservation assertions remain. Development runs encountered traced resource-loading failures; the complete compiled-artifact run passed.
- Audit: zero production dependency advisories; the full dependency scan reports 22 existing development/build findings (19 moderate, 3 low; no high/critical). Dependency versions are unchanged. Physical projector/iPad testing and exhaustive service-worker upgrade scenarios remain unverified.
- This entry records pre-release verification. The release must still verify the deployed artifact and changed live flow. Existing untracked `docs/design/before/` is excluded from this change.

## 2026-11-02: Games tab (implementation and audit complete)

- Owner-selected Games tab: **Castle Quest**, **Knight Treasure Trail** and **Chess Detective**, with navigation, Home entry and stable game deep links. The other proposed games remain future ideas.
- Castle has three five-room adventures from existing beginner capture, mate-in-one and fork puzzles. Knight has nine treasure routes, legal jumps, shortest-route hints, undo and restart. Detective has nine CC0-sourced cases: identify the unprotected piece, then prove a safe legal capture; equivalent captures are accepted.
- Best stars persist per student and survive the existing export/import/reset flows. Legacy v1 saves remain readable; replay cannot farm global XP. Profile changes reset in-flight games, save guards check the originating student, and failed saves offer retry without claiming success.
- Independent chess review: all three games safe to teach; all selected puzzle moves, unique Detective targets, captures and optimal knight paths verified. Code and classroom reviews: ship. No dependencies, course-review flags or generated puzzle-data changes.
- Audit fixes proved before/after: game navigation retained stale scroll; dark exit flag had 2.09:1 contrast; desktop launch/selection/board layouts exceeded the teaching viewport; a long name overflowed the 1280px header after adding Games. Final dark flag contrast is 6.26:1; desktop choices and active controls fit, with phone/portrait scrolling retained.
- Main-session final gates PASS: **587 unit tests**, typecheck, lint, content validator (10 courses / 95 lessons / 295 steps / zero issues), and puzzle size 2.80 MB. Production dependency audit: zero findings.
- Root-path production build PASS; **90/90 production E2E PASS** (22 Games cases plus 68 existing), one worker, zero retries, unchanged timeouts. Main independently completed an offline reload, a knight trail, a Detective capture and all five Castle rooms with a real activated service worker and zero JavaScript errors.
- Evidence and release receipt: `E:/AI-HQ/Projects/Knightlight-Games/2026-11-02/`. The 122-file tested artifact has a SHA-256 inventory for exact deployment. Commit, push and Cloudflare release are authorized and pending release execution; deployed assets and live games must be verified afterward.
- Physical projector/iPad/audio and exhaustive service-worker upgrade scenarios remain unverified. Existing untracked `docs/design/before/` is preserved and excluded.
