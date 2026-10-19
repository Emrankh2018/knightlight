# Content, data and delivery audit — 2026-10-19

Read-only audit of the current checkout. No source files changed. Reproduction fixtures and evidence remain in this directory. Existing generated data was not modified. Scope: original course data consistency, chess legality and concrete elementary claims, pipeline safety, license inventory, service-worker build output and public host GET responses.

## Confirmed findings

### CD-01 — P2 — failed puzzle generation destroys the previous good output

- Source: `scripts/build-puzzles.ts:273-275`, size enforcement at `:319`.
- Trigger: replacement generation exceeds the size budget, or an output write fails after deletion. The script removes the entire previous output before writing and checks the total byte limit only after replacement files and index have been written. A failure is therefore not a safe abort: the previous valid set is lost and invalid/incomplete replacement output remains.
- Reproduction: `rtk proxy node .tmp/audit-2026-10-19/content-delivery/pipeline-repro.mjs`. It runs the actual output-writing code transpiled into an isolated `.tmp` fixture, with a deliberately reduced zero-byte budget and no network/download work. The fixture exits 1, `knownGoodRemains:false`, `replacementIndexExists:true`; stderr says `Output 558 bytes exceeds the 25 MB limit`.
- Evidence: `pipeline-repro-results.json`; `fixture-puzzles.mjs`. This demonstrates failure behavior, not oversized currently shipped puzzles (the current set is within budget).
- Owner: implementer; test-engineer proves failed regeneration preserves old output.
- Fix: render and validate all files and total size in staging, then replace only on success. Clean staging on failure.
- Acceptance: an over-budget fixture and injected write failure leave all prior output byte-identical; successful generation replaces the set and passes puzzle checks.

### CD-02 — P2 — removed course payloads survive successful regeneration

- Source: `scripts/build-content.ts:20-31`.
- Trigger: delete/rename a source course and run `npm run data:content`. Builder overwrites current courses/catalog but never removes generated JSON for absent slugs. The obsolete course remains a public asset and can be fetched or loaded by its direct URL despite its removal from the catalog.
- Reproduction: the same isolated fixture uses actual builder code with its loader redirected to a single current course and pre-existing `removed-course.json`. Exit 0, `removedCourseRemains:true`.
- Evidence: `pipeline-repro-results.json`; `fixture-content.mjs`. No stale orphan currently found in the checkout; the deterministic failure is in course-removal handling.
- Owner: implementer; test-engineer covers course removal/rename.
- Fix: stage the exact validated course output set and replace the old generated directory, or remove only known obsolete generated course JSON after successful validation.
- Acceptance: after removing a fixture source, the catalog and emitted directory contain precisely the remaining courses, and failed validation preserves the old complete set.

### CD-03 — P3 — README and complete coach checklist absent

- Source: `AGENTS.md:29` requires Lichess credit in footer and README; no `README.md` exists. Footer attribution exists at `src/components/Layout.tsx:92` and its CC0 wording at `src/i18n/en.ts:11`.
- `REVIEW_CHECKLIST.md` covers seven named courses, but omits shipped `sample-basics`, which has one lesson/four steps and `reviewed:false`.
- Owner: implementer for README/run/deploy/offline instructions; chess-content-author then chess-fact-checker for sample checklist entry (or intentional sample removal through source pipeline).
- Acceptance: README documents actual static/Cloudflare deployment and data attribution; every catalog course has a coach checklist entry.

## Verified data inventory

`check.ts` is preserved; rerun with `rtk proxy npx --no-install tsx .tmp/audit-2026-10-19/content-delivery/check.ts`.

- Source parser: zero issues. All eight generated course payloads and catalog entries exactly match source-parsed results.
- 30 chapters, 82 lessons, 246 steps; all eight courses `reviewed:false`.
- Course counts: checkmate-patterns 4/11/33; italian-game 4/13/35; london-system 4/12/33; queens-gambit 4/10/26; ruy-lopez 4/11/28; sample-basics 1/1/4; sicilian-defence 4/12/37; tactics-basics 5/12/50 (chapters/lessons/steps).
- Every course step replays legally. Stored SAN, UCI and resulting FEN agree. All nine find-move exercises ending with a one-move mate have exactly one legal mating answer. The other three mating find-move exercises are longer scripted trap/trade lines and are not claimed to force mate against every defense.
- Puzzle index: 75 nonempty buckets + index, 11,900 bucket records, 11,794 unique puzzle IDs, 2,940,037 bytes. Counts, rating bands, theme membership and per-bucket ID uniqueness match. Repeated IDs across theme/mixed buckets have identical payloads. Every mateIn1/2/3 label has exactly 2/4/6 stored plies respectively. Full puzzle replay is covered by the central test run, not duplicated here.
- Openings: 3,865 entries, 7,983 indexed positions and 8,192 continuations. Every continuation legally replays to its stored EPD and UCI; indices are in range.
- No concrete incorrect chess move, mate assertion or elementary material/attack claim was established in reviewed targeted source reads. Human wording/age suitability, complete theoretical evaluation and original authorship remain unverified; keep coach checklist warnings and `reviewed:false`.

## Dependency and license checks

- `rtk proxy npm audit --json` completed with zero known vulnerability advisories (617 dependency nodes in audit metadata). This is a database result, not a general security proof.
- Lockfile license inventory: no GPL/AGPL package identifiers. Production dependencies are permissively licensed according to local metadata.
- Policy question: `AGENTS.md` also says use permissive licenses only. Build tooling includes MPL-2.0 `lightningcss` (`package-lock.json:6657-6662`, and nested Vite version at `:8781-8786`, 24 lock entries including optional platforms). These are dev build tools; evidence does not establish MPL code distributed in browser assets. Clarify whether the permissive-only policy covers dev tools before proposing a toolchain migration. `caniuse-lite` carries CC-BY-4.0 metadata as development data.
- License declarations alone do not verify every bundled upstream notice. No plagiarism claim or external-content provenance verification was performed.

## Service worker and production boundary

- Built `dist/index.html` includes the injected `/knightlight/registerSW.js` script. That registers `/knightlight/sw.js` with scope `/knightlight/`.
- `dist/sw.js` exists (9,684 characters at snapshot); 76 puzzle paths are precached and the `knightlight-data` runtime cache is present. Courses/openings are runtime cached as first used, as explicitly configured in `vite.config.ts:34-42`. Browser offline behavior belongs to the root's runtime verification.
- Public host read-only GET evidence is in `public-host.json`: root, service worker, manifest and both data catalogs return HTTP 200 with suitable HTML/JS/manifest/JSON MIME types. Headers use `public, max-age=0, must-revalidate`.
- The current public host catalog contains FOUR courses: checkmate-patterns, italian-game, sample-basics, tactics-basics; current checkout contains EIGHT. Production JS points to `index-DTZLymUc.js`; audited local build had a different artifact. Thus local findings and passed tests do not prove the additional four courses or latest routes deployed. This is deployment divergence, not automatically a bug or authorization to deploy.
- No CSP, `X-Content-Type-Options` or HSTS header was observed on these GETs. Consider explicit headers as defense in depth; no exploitable header-related defect demonstrated.
- `scripts/deploy.mjs:14-15` runs build then unpinned `npx wrangler deploy`; there is no checked-in Wrangler config or CI workflow. Reproducible/pinned release tooling and recorded served build identity are improvement opportunities. No deployment, provider access or GitHub mutation was performed.

## Remaining limitations

- No backend/account/database exists in this static architecture.
- No paid API, provider install, live DB or credential read was used.
- Central gates, browser checks, build tests and native device/audio checks are outside this delegated slice.
- Build alone does not regenerate or assert course-data freshness (`package.json:9,19`); it currently matches, but add a nonmutating generated-data consistency gate for future edits.
- Knowledge notes were read for routing only. Relevant memory was prior gates failure context, not used as current validation evidence: `MEMORY.md:1864-1874`, rollout `01a152bf-1d77-7c41-8a6e-45a3a986c71d`.
