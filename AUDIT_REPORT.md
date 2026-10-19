# Knightlight audit and stop checkpoint

Date: 2026-10-19 (UTC+03:00). Author: Codex.

**Status: audit findings saved; work stopped at the user's request. No application or test fixes, commit, push, or deployment were performed.** The user subsequently explicitly requested a shared Obsidian handoff for Claude. This report is a dated snapshot, not evidence that a later checkout or live deployment has the same behavior.

## Decision and scope

**Do not treat this checkout as ready for release until the two P1 issues are repaired and the failed checks are resolved.** The most serious findings concern failed backup imports losing the student roster and accepted extreme XP values freezing the interface. Existing unit tests and a successful build do not cover those failures adequately.

Audited checkout: `C:/Users/welcome/Desktop/mychess`, HEAD `cb4e991953a5c891d58f8d4863bfb35181051802` **plus substantial pre-existing modified and untracked work**. Audit agents preserved that work. SHA256 comparisons of 264 input files found no drift from 13:45:09 to 13:52:43 UTC+03:00, spanning the later gate phase, build, E2E and production diagnostics. The beginning of the gate run was not fingerprinted. See the archived manifest.

Knightlight is a static React PWA with local profiles and browser storage. There is no application backend, account service, server database, or API authentication system to audit. The relevant service-like layers are the chess Web Worker, persistence/import/export, generated content, service worker and static delivery.

Completed coverage: project instructions/plan/handoff; local graph navigation; source review; typecheck/lint/unit/content gates; production build; all existing E2E tests; targeted production browser diagnostics; route/layout captures; keyboard/dialog/accessibility review; import/quota/numeric/parser reproductions; data consistency and chess replay; pipeline failure fixtures; dependency advisory/license metadata; read-only public-host responses. No new E2E tests were written.

Graph extraction was local AST-only: `graphify extract . --code-only --no-cluster --max-workers 2`, producing 1,099 nodes / 3,348 edges. Bounded 800-token queries identified LessonPlayer and chooseMove relationships; importBackup had no match and was located by source reads. PGN and prose are outside code-only graph coverage. Added `.graphifyignore` to exclude secrets, dependencies, caches and agent configuration before extraction; generated graph remains ignored.

## Verification results

| Check | Observed result |
| --- | --- |
| `node scripts/gates.mjs` | **FAIL**, exit 1: lint is the only failed gate |
| Typecheck | PASS |
| Lint | FAIL: `tests/students-hardening.test.ts:115:14`, `no-control-regex`, 1 error / 0 warnings |
| Unit tests | **542 / 542 passed** |
| Content validator | **8 courses / 30 chapters / 82 lessons / 246 steps / 0 issues** |
| Puzzle size | **2.80 MiB**, below 25 MiB limit; 2,940,037 bytes |
| Coach flags | 0 / 8 courses reviewed; all remain `reviewed:false` |
| `npm run build` | PASS, exit 0; 112 modules, PWA 111 precache entries / 3,546.75 KiB |
| Existing E2E suite | **46 passed / 12 failed / 58 total**, exit 1 |
| E2E diagnosis | 11 stale selectors/roles/copy; 1 real Teacher Present geometry failure |
| Production diagnostics with current controls | White/Black bot play, avatar/reset, invalid-version rejection, assignment navigation PASS; Teacher portrait geometry FAIL |
| Native production module Worker | PASS: returned a legal move in Chromium |
| Production offline smoke | All 75 puzzle buckets / 5 levels / 11,900 rows available offline; visited lesson reload and an unvisited puzzle route PASS |
| Unvisited course offline | Displays localized load failure, consistent with documented cache-on-use policy |
| Data consistency | Source and generated courses match; course lines and all 8,192 indexed opening transitions legally replay |
| `npm audit --json` | 0 known advisories at audit time; not a general security guarantee |
| `git diff --check` | PASS; existing CRLF-to-LF notices only |

The initial temporary PWA harness used a stale exact text locator and failed. That harness was corrected only under `.tmp`; the completed smoke is the valid result. Historical harness output remains outside the permanent evidence selection. Production diagnostics are supplemental and do not turn the failed checked-in suite green.

## Fix backlog

All entries are **OPEN / NOT FIXED**. P1 means high-impact data loss or application unavailability; P2 means a concrete correctness, usability, accessibility or verification defect; P3 means lower-impact requirements/documentation work. No P0 issue was established. Owners refer to `AGENTS.md`; the main session must sanity-check diagnosis and acceptance before dispatch.

| ID | Priority | Finding and source | Minimal fix and acceptance |
| --- | --- | --- | --- |
| AUD-01 | **P1** | Failed import can replace the old roster. `src/store/backup.ts:99-103`: rollback restores the larger old roster before removing new progress; quota blocks restoration and its result is ignored. Isolated 20-old/2-new-profile fixture returns failure but retains the new roster. | Implementer: make commit/rollback quota-safe, check recovery failures. Inject failure at every write; rejected imports must preserve every original key/value byte-for-byte. |
| AUD-02 | **P1** | Accepted `xp:1e308` hangs `levelFor`, including import preview before confirmation. `src/lib/xp.ts:53-58`; validation `src/store/progress.ts:76`; preview `src/components/students/BackupPanel.tsx:113`. Bounded child process times out. | Implementer: safe numeric bounds and a total, bounded-time level calculation. Extreme finite values, MAX_VALUE, NaN, Infinity and ordinary level boundaries must terminate; unsafe backups rejected before preview. |
| AUD-03 | P2 | Unbounded accepted SRS interval/ease produces `due:"0NaN-NaN-NaN"`; reload rejects and resets the whole progress record. `src/store/progress.ts:59-64`, `src/lib/srs.ts:27-30,64`, `src/lib/date.ts:30-33`. | Implementer: bound/sanitize scheduling inputs and validate outputs; prefer isolating invalid items. Large values and repeated grades must roundtrip with valid bounded dates and preserve unrelated XP. |
| AUD-04 | P2 | Corrupt-progress recovery overwrites the original even when writing the backup failed. `src/store/progress.ts:120-122`. Quota fixture loses both original and backup. | Implementer: retain original bytes unless recovery persistence succeeds; expose storage failure. Regression must fail the backup write specifically and preserve the raw original. |
| AUD-05 | P2 | Failed progress saves appear successful, while Export reads stale storage and omits current in-memory results. `src/store/progress.ts:174-177`, `src/store/backup.ts:23`. Fixture: visible XP20, exported XP0. | Implementer: track/report unsaved state and include it in emergency export. Test quota/blocked storage after startup, progress, export, profile switch and reload. Review ignored profile/settings writes too. |
| AUD-06 | P2 | Student switch retains the previous student's active learning/game session. `src/components/ProfileSwitcher.tsx:58`, `src/routes/Puzzles.tsx:113-135`, `src/routes/Review.tsx:50,132`, `src/routes/Play.tsx:64,172`. Browser probe: A's hinted puzzle stays identical after switching to B; revealing it records the attempt/SRS item on B. | Implementer: bind sessions and asynchronous callbacks to an owner or reset/cancel on profile change. Test mid-puzzle/lesson/review/game switches, including pending bot replies. The puzzle case is browser-proven; the other routes have the same source lifecycle risk and need regression coverage. |
| AUD-07 | P2 | PGN tags `__proto__`, `constructor`, `toString` throw `list.push is not a function`. `src/lib/content/pgn.ts:60-62,106`. | Implementer: null-prototype dictionaries/own-property checks throughout readers. Malformed names must return structured results without changing prototypes. Affects authoring/validation, not a server upload endpoint. |
| AUD-08 | P2 | Roughly150KB malformed PGN crashes validation via argument spread. `src/lib/content/parse.ts:55`, `errs.push(...game.errors)`. | Implementer: loop and cap diagnostics with truncation information. 150,000 malformed tokens must produce bounded diagnostics without throwing. |
| AUD-09 | P2 | Shared header overflows all 14 sampled routes at390px: document498px, menu starts x408.6 offscreen. `src/components/Layout.tsx:43,57,67`. | Implementer: reflow/compact header while keeping controls accessible. At390px and tablet/desktop widths no horizontal overflow; menu and student control remain visible. |
| AUD-10 | P2 | Puzzle Class Mode fails1024x768 fit: overlay943px, Next bottom788.5px. Portrait768x1024 also scrolls. `src/components/PuzzleRound.tsx:278,283`, class board sizing in `src/index.css`. | Implementer: jointly budget board/panel height and reserve essential controls. Verify1366x768,1024x768,768x1024,820x1180 including feedback states. |
| AUD-11 | P2 | Teacher Present hides Exit/tools below visible area. `src/routes/Teacher.tsx:290,293,300`. Production820x1180: scroll1221, Exit bottom1203.125; also reproduced1024x768 and768x1024. | Implementer: keep exit/tools outside scrolling content and bound layout. Existing failing E2E and added viewport/state regressions must pass without reducing board usability. |
| AUD-12 | P2 | Search button and Ctrl/Cmd+K do nothing useful: event dispatched with no consumer. `src/components/SearchSlot.tsx:4,12,21`. Browser: no dialog/input or text change. | Implementer: implement approved search palette or remove unavailable control/shortcut until ready. Verify mouse and keyboard access, localized results, focus, Escape and no browser-shortcut suppression without an action. |
| AUD-13 | P2 | Board keyboard cursor/selection is visual only. `src/components/Board.tsx:169-220,263,271,311`. Live ArrowUp leaves accessible label unchanged and status regions empty. | Implementer: localized square/piece/selection/legal-target announcements. Keyboard users relying on spoken feedback must identify and complete moves; verify with an actual screen reader. |
| AUD-14 | P2 | Input boundaries use low-contrast border-line. `src/routes/Openings.tsx:265,286`, `src/routes/Teacher.tsx:273`, `src/components/LoadBox.tsx:36`. Light1.33-1.40:1 / dark1.52-1.88:1, below3:1. | Implementer: use a stronger input-boundary token exceeding3:1 against adjacent surfaces in both themes. Decorative card borders are excluded from this finding. |
| AUD-15 | P2 | Play resignation confirmation declares alertdialog without modal focus handling. `src/routes/Play.tsx:381`. Live keyboard focus stays on Give up, Tab leaves confirmation, Escape does not close. | Implementer: reuse native Modal/ConfirmDialog. Initial Cancel focus, contained tab order, Escape cancellation and restored opener focus required. |
| AUD-16 | P2 | Puzzle builder deletes known-good output before validating replacement size. `scripts/build-puzzles.ts:274,319`. Isolated forced over-budget run loses old output and leaves replacement index. | Implementer: stage and validate complete output before replacement. Over-budget and injected write-failure fixtures must preserve original files byte-for-byte. Regenerate only through data scripts. |
| AUD-17 | P2 | Course regeneration leaves removed/renamed payloads publicly fetchable. `scripts/build-content.ts:20-31`. Isolated removed-course fixture survives successful generation. | Implementer: emit exact validated output set using staging or safe obsolete-file cleanup. Deleted source courses must disappear from payload directory; failed builds preserve last good set. No stale orphan currently found in shipped data. |
| AUD-18 | P2 | Lint gate fails on control-character regex. `tests/students-hardening.test.ts:115:14`. | Test-engineer: preserve assertion semantics using a lint-valid representation. No disable comments or rule relaxation; full lint/gates must pass. |
| AUD-19 | P2 | Eleven existing E2E tests lag current accessible roles/copy. `e2e/play.spec.ts:8,23`; `e2e/students.spec.ts:22,109,158,186`. | Test-engineer: first confirm intended UI contracts, update selectors while retaining behavior assertions. All58 tests must execute intended behavior and pass; do not increase timeouts to mask failures. See verification appendix for exact mismatches. |
| AUD-20 | P3 | Position summaries and footer link text bypass locale file. `src/lib/describe.ts:3,12,25-28`, `src/components/Layout.tsx:92`. | Implementer: move user-facing words/templates into `src/i18n/en.ts`; retain chess data/coordinates as data. Include new spoken board feedback in localization. |
| AUD-21 | P3 | Toast dismissal is40x40px at tablet font size. `src/components/Toasts.tsx:21`. | Implementer: at least44x44px; verify actual tablet computed box, focus and dismissal. |
| AUD-22 | P3 | README absent despite attribution/documentation requirement; shipped sample-basics absent from coach checklist. `AGENTS.md:29`, `REVIEW_CHECKLIST.md`. | Implementer: README with actual static/Cloudflare/offline/backup instructions and CC0 credit. Content owner/fact-checker: ensure every shipped course has coach checklist coverage, or remove sample through source pipeline. |

Detailed proof and fix specifications for persistence/parser issues: [correctness review](docs/audits/2026-10-19/evidence/code-review/findings.md). Pipeline/data proof: [content and delivery review](docs/audits/2026-10-19/evidence/content-delivery/FINDINGS.md). Check-by-check verification and all stale E2E expectations: [verification appendix](docs/audits/2026-10-19/evidence/checks/REPORT.md).

## UI evidence and positive checks

Root browser sweep captured42 route/viewport observations (14 routes at1366x768,1024x768,390x844),9 Present/Class states and1 search probe:52 observations, no page errors. These are snapshots, not exhaustive state coverage.

- [Phone header](docs/audits/2026-10-19/evidence/ui/390-_.png)
- [Puzzle Class Mode1024](docs/audits/2026-10-19/evidence/ui/present-1024-_puzzles_level_beginner_theme_mateIn1.png)
- [Teacher Present portrait](docs/audits/2026-10-19/evidence/checks/teacher-present-portrait.png)
- [Measured UI state](docs/audits/2026-10-19/evidence/ui/results.json) and [profile-switch probe](docs/audits/2026-10-19/evidence/ui/profile-switch.json)

Sampled lesson Present geometry passes1366x768,1024x768 and768x1024. Student native dialog passes targeted initial focus, reverse Tab containment, Escape cancellation and opener restoration at768x1024; controls measured at least48px. Core text contrast passes calculated theme ratios; stronger input borders are still required. Reduced-motion CSS and Board animation opt-out exist; live button transition reduces under emulation. No actionable physical-direction CSS issue found in targeted source scan; Board intentionally uses LTR chess coordinates.

Optional visual improvements, not release-blocking findings: larger Teacher Present supporting text on portrait tablets; stronger completed-checkmark contrast (currently2.69:1, decorative/aria-hidden with separate Done text).

## Content, security and delivery boundaries

- Eight source/generated-identical courses, all unreviewed. Legal replay, elementary mate checks and validator success do **not** constitute complete theoretical/pedagogical fact-checking or coach sign-off. Original authorship was not independently proven. Preserve `reviewed:false` and the coach checklist.
- Puzzle inventory:11,900 bucket records /11,794 unique IDs,75 buckets; no within-bucket duplicate IDs or indexed count/rating/theme mismatch established. Current puzzles are inside size budget. Opening inventory:3,865 entries,7,983 positions,8,192 checked transitions.
- No dangerous HTML/eval sink found in targeted source search. Limited credential-pattern scan of application/scripts/content/public/package files found no matching private-key/API-token patterns. Git history, ignored/private files and all possible secret formats were not audited.
- Local dependency metadata reports no GPL/AGPL identifiers and permissive production dependencies. **Policy question:** build tooling includes MPL-2.0 lightningcss (24 lock entries including optional platforms); clarify whether the permissive-only rule covers development tooling. No claim that MPL code ships in browser assets was established. Metadata is not a complete bundled-notice audit.
- Read-only public GETs returned200 with suitable MIME types for home, SW, manifest and data catalogs. Host: `https://knightlight.omrankhammash.workers.dev`. **Live catalog has4 courses; local checkout has8 and different JS assets.** Local checks do not prove current working changes are deployed. No release performed.
- No CSP/nosniff/HSTS was observed on sampled responses: defense-in-depth opportunity, not a demonstrated exploit. Release script uses unpinned `npx wrangler`; no checked-in CI workflow/Wrangler config found. Consider pinned release tooling and served build identification separately from application repairs.
- Courses/openings cache on first use; puzzles precache after a successful initial visit. An unvisited course failing offline is consistent with current design. Cold first visit offline is not supported by this evidence.

## Questions and untested areas

1. `src/lib/play.ts:86` defines `creditFor` (resignation/no assisted win credit), while `src/routes/Play.tsx:160-173` still calculates/records direct result credit. Resolve the intended acceptance contract before modifying the route or its E2E assertions. This is an integration question, not a claimed proven XP exploit.
2. Multiple tabs have no persistence concurrency protocol. Confirm whether simultaneous tabs must be supported before designing a migration/transaction change.
3. Not tested: physical iPad/touch/drag, Safari/WebKit/Firefox, actual screen-reader speech, projector readability, real speaker audio, browser-specific private-mode/quota behavior, two-version SW upgrade/interruption, cache eviction/storage pressure, full keyboard sweep, exhaustive arbitrary PGN/import fuzzing, broad performance/load profiling, deployed source identity or CI. No full accessibility certification, penetration-test certification, or guarantee of zero remaining bugs is claimed.
4. Historic PROGRESS sections conflict with current implementation (placeholders/icons/native worker statements). The new checkpoint below supersedes those claims only for this audit snapshot; preserve historical records.

## Resume plan and ownership

The user asked to stop. **Do not automatically resume, deploy, or start repairs from this note.** Claude or Codex should first read the current user request, AGENTS.md and this report, compare the current checkout/manifest and reproduce the selected issue.

Suggested bounded order when work is resumed:

1. Diagnose/reconfirm AUD-01 and AUD-02; dispatch implementer for narrow persistence/numeric fixes and test-engineer for meaningful fail-before/pass-after regressions.
2. Repair AUD-03 through AUD-08; protect unsaved data and profile ownership before UI polish.
3. Repair UI findings AUD-09 through AUD-15, then input/dialog/accessibility review with classroom-ui-reviewer after code-reviewer.
4. Repair generator safety AUD-16/17; never hand-edit generated public data.
5. Resolve UI contract questions, repair AUD-18/19 test representations/selectors; keep original behavior assertions. Complete P3 documentation/localization/targets.
6. Run gates, build and full E2E, repeat affected production/offline/quota checks, code review and classroom review. Only then consider a separately authorized release and verify live artifacts.

Agent sequence remains the repository's debugger -> responsible owner -> test-engineer -> code-reviewer -> classroom-ui-reviewer for UI -> gates. No tests may be deleted, skipped, loosened, or lint rules disabled just to get green.

## Saved checkpoint and Git boundary

Permanent evidence is under `docs/audits/2026-10-19/evidence/`. Original temporary harnesses/fixtures also remain under `.tmp/audit-2026-10-19/` (ignored). Archived scripts preserve their original paths/import assumptions: restore their subdirectories into `.tmp/audit-2026-10-19/` before rerunning, from the repository root. Main commands:

```text
rtk proxy node --import tsx .tmp/audit-2026-10-19/code-review/repro.mjs
rtk proxy node .tmp/audit-2026-10-19/content-delivery/pipeline-repro.mjs
rtk proxy npx --no-install tsx .tmp/audit-2026-10-19/content-delivery/check.ts
```

Audit-added repository changes: this report, permanent evidence, `.graphifyignore`, and a dated PROGRESS checkpoint. Tool-created `.playwright-mcp/` is local audit output; do not stage it. All other pre-existing dirty source/content/tests were preserved and are outside an audit-only commit.

Proposed documentation commit, **not executed**: `docs: checkpoint Knightlight platform audit` (report, evidence, graph ignore and the audit-only PROGRESS addition after reviewing its full diff). Current Git status is saved in the evidence folder; stage exact reviewed files only, never `git add .`. The project checkpoint skill requires explicit approval before release-engineer commits; no commit approval was requested during the user's stop request. No push/deploy.

Shared Claude handoff: `C:/Users/welcome/AI-Shared-Brain/Handoffs/2026-10-19-codex-knightlight-audit-checkpoint.md`. Dedicated Codex continuity is separate. This is a user-requested one-time handoff, with no automatic vault synchronization or message sent to another chat.
