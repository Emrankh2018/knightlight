# Full audit: correctness, persistence and security review

Observed 2026-10-19. Read-only source review of the current working tree, not only the Git diff. Source files were changing in another chat; exact SHA-256 fingerprints and UTC observation time are in `repro-output.json`. Re-read the cited source before applying fixes.

Verdict: **do not ship as a completed audited platform until the P1 items are fixed**. The app has no server or accounts: backend/auth/database checks are not applicable. Engine worker failure handling has a watchdog and fallback; normal Play terminal conditions check checkmate, stalemate, insufficient material, repetition and fifty-move draws. No source fix was made during this review.

Reproduction: from repository root run `node --import tsx .tmp/audit-2026-10-19/code-review/repro.mjs`. It uses an isolated in-memory storage mock, never actual browser/user data. It logs actual imported implementation results. The XP nontermination case is run in a bounded child process.

## CR-01 — P1: a failed import can replace and lose the original roster

- Evidence: `src/store/backup.ts:99-103` rollback iterates insertion order, restoring the old roster before removing newly created progress keys. Every restore result is ignored.
- Scenario: original roster has 20 profiles; replacement has 2 profiles and about 2 KB of progress per student. Simulated quota 3,500 or 4,000 characters permits the first new progress record and rejects the second. Original data fits before the import.
- Observed: `applyBackup` returns `ok:false`; stored roster remains `[new0,new1]`; rollback removes both new progress records. Original 20 students disappear after reload. Restoring the old larger roster failed only because new progress still consumed space; cleanup later freed space without retrying restoration.
- Expected: a rejected import preserves every pre-import key/value.
- Minimal fix: remove newly created keys and restore overwritten values in a quota-safe order; check restoration success. Prefer preparing a transaction snapshot and committing one authoritative record/pointer so partial imports cannot become active. Do not report ordinary failure if rollback failed without preserving a recovery copy.
- Regression acceptance: inject failure at every write using a realistic total-storage quota. Assert byte-for-byte original roster, settings and progress after each rejected import; old and new profile IDs must differ and the old roster must be larger.
- Owner: implementer; test-engineer proves regression.

## CR-02 — P1: a structurally valid backup can freeze the UI before import confirmation

- Evidence: `src/lib/xp.ts:53-58`; `src/store/progress.ts:76` accepts every finite nonnegative integer; `src/components/students/BackupPanel.tsx:113` calls `statsFor` in the pending-backup preview, which calls `levelFor`.
- Scenario: choose an otherwise valid backup containing `xp:1e308`.
- Observed: both `validateProgress` and `parseBackup` accept it. `levelFor(1e308)` never returns (isolated process killed after 1.5 seconds). At enormous levels, intermediate XP multiplication overflows and decrementing the floating-point level by 1 no longer changes it.
- Expected: every accepted backup previews in bounded time without freezing the main thread.
- Minimal fix: impose a documented safe XP bound at the import/storage boundary and make `levelFor` total for all numbers. Remove unbounded correction loops or bound their work and use overflow-safe arithmetic.
- Regression acceptance: `Number.MAX_VALUE`, `1e308`, huge finite integer inputs, Infinity, NaN and ordinary exact level boundaries return promptly; invalid backups are rejected before preview.
- Owner: implementer; test-engineer proves regression.

## CR-03 — P2: accepted SRS values corrupt the saved record after a review

- Evidence: `src/store/progress.ts:59-64` accepts unbounded interval/ease; `src/lib/srs.ts:27-30,64` multiplies interval without bounds; `src/lib/date.ts:30-33` formats an invalid Date without checking it.
- Scenario: valid progress with 250 XP and one due SRS item having interval 1,000,000,000 and reps 3; answer good.
- Observed: validation accepts it; review returns interval 2,500,000,000 and `due:"0NaN-NaN-NaN"`. After persisting and reloading, `readProgress` rejects the entire profile record and resets XP to 0. A recovery copy is attempted, subject to CR-04.
- Expected: every accepted SRS state remains valid after every grade; unrelated progress must survive a damaged SRS item.
- Minimal fix: clamp/sanitize interval and ease in both input validation and scheduling (the existing handoff proposes 1–365 days); validate computed day strings. Consider rejecting/quarantining the individual damaged item instead of wiping the entire profile.
- Regression acceptance: huge interval/ease values, near-boundary calendar days and repeated good/easy grades always produce valid bounded dates; roundtrip validation succeeds and XP remains intact.
- Owner: implementer; test-engineer proves regression.

## CR-04 — P2: corruption recovery destroys the only original copy when quota prevents the backup

- Evidence: `src/store/progress.ts:120-122` ignores the backup write result before overwriting the original.
- Scenario: a corrupt or future-version progress record uses most of the storage quota. Duplicating it into the recovery key fails, while replacing the original with the much smaller empty record succeeds.
- Observed: quota 2,200 characters and a 1,901-character corrupt record produces `backupPresent:false`, `originalPresent:false` after `readProgress`.
- Expected: damaged data stays available for manual recovery whenever the backup cannot be persisted.
- Minimal fix: never overwrite/delete the original unless preserving its recovery copy succeeds; return an in-memory fallback plus a visible recovery/storage error if it cannot be backed up.
- Regression acceptance: fail only the backup write under quota and assert the original raw bytes remain unchanged; repeated reads cannot overwrite a previously retained recovery copy inadvertently.
- Owner: implementer; test-engineer proves regression.

## CR-05 — P2: unsaved progress looks successful, and Export silently omits it

- Evidence: `src/store/progress.ts:174-177` discards persistence failure and updates the visible state; `src/store/backup.ts:23` exports storage rather than the current active progress state. Similar ignored writes exist in profile/settings persistence.
- Scenario: browser storage becomes full or blocked after the app loads; solve a puzzle, then choose Export before leaving.
- Observed: current visible XP is 20, exported XP is 0, exported solved map is empty; there is no save failure notice. Reload loses the visibly earned result. Export cannot rescue the current in-memory progress.
- Expected: storage failures are visible and an emergency export includes the active unsaved state.
- Minimal fix: track/report save failures, retain a dirty in-memory record, and export it for the active profile. Define transactional success/failure for add/rename/remove/settings too; do not claim persistent success after a failed write.
- Regression acceptance: start with working storage, then inject quota failure; earned results remain exportable, notices explain the failed save, and switching/reloading cannot silently discard unsaved state.
- Owner: implementer; test-engineer proves regression.

## CR-06 — P2: PGN prototype-property tags crash the parser

- Evidence: `src/lib/content/pgn.ts:60-62,106` uses a regular object for tags and assumes inherited properties are arrays.
- Scenario: content includes `[__proto__ "x"]`, `[constructor "x"]` or `[toString "x"]` before moves.
- Observed: every case throws `TypeError: list.push is not a function` instead of collecting a ContentIssue. This affects content authoring/build validation, not a shipped public upload endpoint.
- Expected: arbitrary/malformed PGN headers never crash validation.
- Minimal fix: store tags in a null-prototype dictionary or use own-property checks before treating a value as a string array; keep the same protection in readers.
- Regression acceptance: all three names produce a safe parsed result or structured rejection; prototype state remains unmodified.
- Owner: implementer; test-engineer proves regression.

## CR-07 — P2: a large malformed PGN overflows the call stack

- Evidence: `src/lib/content/parse.ts:55` spreads every game error as an argument to `push`.
- Scenario: one game with valid lesson/title/step headers and 150,000 unmatched closing parentheses (roughly 150 KB input).
- Observed: `parseChapter` throws `RangeError: Maximum call stack size exceeded`.
- Expected: malformed content reports bounded diagnostics without crashing validation.
- Minimal fix: loop over errors instead of argument spreading; cap diagnostics per game and preserve a truncation count/message. Review other large spreads of externally sized data.
- Regression acceptance: 150,000 malformed tokens return a bounded list of ContentIssue entries without throwing or excessive output.
- Owner: implementer; test-engineer proves regression.

## CR-08 — P1/P2 pending browser corroboration: sessions survive a header profile switch

- Source chain is confirmed: `src/components/ProfileSwitcher.tsx:58` switches profiles without navigation; `src/App.tsx` does not key learning/game routes by profile; `src/routes/Puzzles.tsx:113-120` retains session position/streak and `:132-135` awards to the current store profile. `src/routes/Review.tsx:50` retains A's queue while `:132` reviews B's current SRS map. `src/routes/Play.tsx:64` retains A's game and `:172` records its result on B. Lesson local step state has the same lifecycle risk.
- Scenario: A partially completes a task/game, switch to B using the header, finish it. Review can also reschedule B's same-ID item using A's session.
- Expected: switch resets/cancels old-profile sessions and async work, or the session remains explicitly bound to the owner it began with. Completed tasks must not inherit partial work from a different student silently.
- Minimal fix: use profile ownership in route/session keys and callback/async guards; include lesson, puzzle, review and bot sessions. Capture owner IDs where results can arrive after a switch.
- Regression acceptance: switch mid-puzzle, mid-lesson, mid-review, and while the bot is thinking; each student's progress/queue remains isolated and the new profile starts a fresh session.
- Owner: implementer; test-engineer proves regression. Root session is performing the browser corroboration to avoid duplicate browser work.

## Questions / gaps

- Current `src/lib/play.ts:86` defines `creditFor` (resign earns nothing; an assisted win earns draw credit), while current `src/routes/Play.tsx:160-173` still awards direct result XP and full wins, and `src/i18n/en.ts:113` defines an unused assisted-win explanation. Likely unfinished concurrent feature work. Recheck the final snapshot and acceptance before classifying this as a defect.
- Multi-tab writes have no storage-event synchronization/concurrency guard. Import code acknowledges this explicitly. Decide whether simultaneous tabs are supported; if so, add revision/transaction ownership and stale-store protection.
- Runtime network/PWA/browser/visual checks, complete gates/build/e2e and dependency/license audit belong to the other audit tracks; this reviewer did not duplicate them.

