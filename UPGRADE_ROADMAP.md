# Knightlight: UI/visual audit and upgrade roadmap

Date: 2026-10-27. Author: Claude. Status: direction approved 2026-10-27 (lamplit study). Phase 0 and 1 done; see section 7. Later phases are not started.

Evidence: the app run locally (Vite dev, 1366x768) and viewed on Home, Courses, Puzzles (picker and round, dark), Play setup and Teacher analysis; plus a read of `src/index.css`, `Layout.tsx`, `Home.tsx` and `Board.tsx`. Not yet checked: phone widths, the lesson player, Students/Review, Present/Class Mode, and light-vs-dark contrast numbers. Findings marked (code) come from source, the rest from screenshots.

## 1. Audit: why it reads as generic

The structure is sound (clear nav, strong focus rings, large touch targets, Class Mode). The look comes from defaults stacked together, with no single memorable idea.

| # | Finding | Where | Severity |
|---|---|---|---|
| V1 | **The board is the stock look** (correction: 3 board themes already exist in settings, cream/sunset/slate, but the default is still teal): teal and cream squares, default react-chessboard pieces, no frame, no shadow, 8px notation. The board is the product and it is the least designed thing on screen. | Puzzles, Teacher, Play | High |
| V2 | **One component repeated everywhere**: white card, 2px border, `rounded-2xl`, amber pill button. Home, Courses, Puzzles theme grid and Play opponent rows are visually the same object, so nothing has priority. | all routes | High |
| V3 | **Home is a dashboard of empty stats**: four equal cards (Level 1, 0 days, "No reviews due", "Browse courses") and 40% blank page. No board, no next action that stands out, nothing that says "chess". | Home | High |
| V4 | **Font is not loaded**: `--font-sans` names Nunito but nothing imports it (code: `index.css:20`, no `@font-face` or link), so most machines show Segoe UI/system. Heading and body are the same face, differing only in weight. | global | High |
| V5 | **Emoji as UI**: speaker and laptop glyphs in the header, fox emoji as avatar, flame as streak. They render differently per OS and clash with the flat teal header. | header, Home | Medium |
| V6 | **Courses have no identity**: text-only cards, identical ring and "Coach is still checking this course" pill on every card. No board thumbnail, opening diagram or colour per course. | Courses | Medium |
| V7 | **Play opponents have names but no faces**: Sleepy Pawn, Curious Knight, Wise Owl are five wide text rows. The personality exists only in copy. | Play | Medium |
| V8 | **Teacher board sits off-centre** with a dead gutter left of it, and the control panel is a plain white card with a dozen same-weight buttons (Undo, Redo, Reset, Flip, Mark, Clear). Presenter's primary controls are not distinguishable. | Teacher | Medium |
| V9 | **Loading is the word "Loading..."** on a blank cream page for every lazy route (seen on Courses, Play, Puzzles). No skeleton, no logo moment. | all lazy routes | Medium |
| V10 | **Palette is used flat**: amber for every primary action and every active state, so "selected", "primary" and "brand" are the same signal. Coral and leaf are barely seen. | global | Medium |
| V11 | **Dark mode is only a recolour**: the board keeps full-brightness cream squares on a near-black page, which is the harshest element on screen. No dark board variant. | dark mode | Low |
| V12 | **No motion language**: piece moves, correct/incorrect feedback, XP gain and level-up have no designed transition. Reduced-motion is respected already (good), so motion is safe to add. | global | Low |
| V13 | **Typography scale is flat**: `text-3xl` page titles and `text-lg` everything else; no eyebrow, no large numeric display for rating/XP/streak. | global | Low |

Strengths to keep: skip link and focus ring, 44px targets, i18n-only strings, RTL-ready layout, Class Mode and Present layouts, readable contrast on the ink header.

## 2. Design direction: "lamplit study"

The name is Knightlight, and the existing mark is a knight inside a crescent of light. Lean into that instead of generic teal.

- **Concept:** a warm, lamp-lit classroom. Dark ink-teal surfaces with a soft amber glow around the thing that matters (the board, the next lesson). Cream paper for reading areas.
- **Board:** custom, calm square colours (muted sage and parchment, not saturated teal), a wooden or ink frame with rank/file labels outside the grid, a subtle inner shadow, last-move and check highlights in amber/coral, legal-move dots, larger notation. Projector-safe: keep the contrast of light vs dark squares at or above the current ratio.
- **Pieces:** an original or clearly permissive set, with licence recorded in DECISIONS.md (project rule: no GPL, no copied content). Do not assume a popular set is acceptable; verify each licence first.
- **Type:** one display face for headings and big numbers plus one text face, both self-hosted (OFL) so the PWA stays offline. Add a numeric style for rating/XP.
- **Colour roles:** amber = primary action only; leaf = correct/progress; coral = mistake; ink-soft = selected. Stop using amber for tabs and filters.
- **Illustration:** a small set of original knight/lamp spot illustrations (empty states, loading, level-up). No Chessly or GothamChess likeness.
- **Icons:** one consistent SVG icon set (MIT/ISC licence) replacing emoji in chrome. Avatars become an original SVG set (the animal idea can stay).

## 3. Roadmap

Each phase ends with `node scripts/gates.mjs` green, a `code-reviewer` pass, and `classroom-ui-reviewer` for UI phases. Sizes are rough (S under a day, M 1 to 3 days, L 3 to 5 days).

### Phase 0: Evidence and baseline (S)
- Capture before-screenshots: every route, light and dark, 1366x768, 1024x768, 768x1024, 390x844, and Present/Class Mode. Store in `docs/design/before/`.
- Measure contrast for board squares, muted text and amber-on-cream (fixes V11 risk before redesign).
- Record Lighthouse and bundle size as the performance budget; the redesign must not regress them.
- Decide the open questions in section 5.

### Phase 1: Design foundation (M) — fixes V4, V5, V10, V13
- Self-host fonts, set a type scale (display, title, body, numeric), remove the unloaded Nunito reference.
- Token pass in `index.css`: semantic colour roles, elevation (shadow) scale, radius scale (stop using one radius everywhere), spacing rhythm.
- Replace emoji in the header with SVG icons; new avatar set.
- Rework `Button`, add `Card` variants (hero, plain, interactive, stat) so V2 has a vocabulary.
- Tests: unit tests for any token helpers; update stale e2e selectors listed in AUDIT_REPORT.md first so the suite is trustworthy.

### Phase 2: The board (M to L) — fixes V1, V11
- Board theme and frame, outside coordinates, move/check/legal-move styling, piece set (licence-verified), piece animation timing.
- Board themes selectable in settings (default plus high-contrast for projectors); dark-mode board variant.
- Keep Present/Class Mode board sizing variables intact; verify at 1024x768 and 768x1024.
- Risk: react-chessboard 5 option names. Fetch current docs (context7) before editing `Board.tsx`.

### Phase 3: Home and navigation (M) — fixes V3, V8 (header part), V9
- Home: one hero ("Continue your lesson" or "Today's puzzle" with a live mini board), then a compact stats strip (level ring, streak, reviews) instead of four equal cards. Real empty state for a new profile.
- Header: stronger logo lockup, active-route indicator that is not just amber text, grouped student tools (sound, theme, profile).
- Skeleton loaders and a branded splash for lazy routes.

### Phase 4: Content surfaces (M to L) — fixes V6, V7, V8
- Courses: board-diagram thumbnails generated from each course's starting/key FEN (no new data needed), per-course accent, progress as a bar with next-lesson label, one "coach is checking" badge style that does not dominate.
- Play: opponent cards with original character illustrations, difficulty shown as a visual scale, side and clock as segmented controls.
- Teacher: centre the board, make Undo/Reset/Flip a compact toolbar and Mark mode a toggle with visible state; move rarely used actions into a menu. Check Present geometry (the one real failure in AUDIT_REPORT.md) at the same time.
- Puzzles: themed icons for the 15 themes; rating shown as a large number.

### Phase 5: Motion and feedback (S to M) — fixes V12
- Correct/incorrect feedback (board flash, piece settle), XP gain count-up, level-up moment, streak flame animation, page transitions.
- Everything gated by `prefers-reduced-motion` (already global in `index.css`). Sound stays optional.

### Phase 6: Responsive and classroom polish (M)
- Phone layout pass (390 wide): bottom nav or compact menu, board-first layout in puzzles and lessons.
- Projector pass: confirm contrast and type size from the back of a room using Present mode; add a high-contrast preset.
- RTL smoke test with a few mirrored strings (layout is claimed RTL-ready; confirm it).
- Full `classroom-ui-reviewer` sweep, then a short coach walkthrough.

### Phase 7: Product upgrades after the visual pass
These build on the new design system and are listed in rough priority. Each needs its own spec before work starts.
1. **Coach review workflow**: tools to mark a course reviewed, a visible review queue driven by `REVIEW_CHECKLIST.md`. Courses stay `reviewed: false` until the coach says otherwise.
2. **Assignments**: richer Assign links (due date, a class code that is still just a hash link), and a printable/QR handout for the projector.
3. **Student progress for coach**: per-student summary on the Students page, local only (no accounts, no backend).
4. **More original content**: additional courses via `chess-content-author` then `chess-fact-checker`, one course per call. Never invent chess facts.
5. **Review/SRS UX**: a daily review session with a clear end state and streak protection.
6. **Accessibility and PWA**: install prompt copy, offline status indicator, and the "unvisited course offline" message from the audit turned into a friendlier "download for offline" button.
7. **Localization**: Arabic strings in `src/i18n` with a language switch, given the RTL groundwork and the owner's Arabic/English focus.

## 4. Suggested order and effort

| Phase | Effort | Visible impact | Depends on |
|---|---|---|---|
| 0 Baseline | S | none | none |
| 1 Foundation | M | medium | 0 |
| 2 Board | M to L | **highest** | 1 |
| 3 Home and nav | M | high | 1 |
| 4 Content surfaces | M to L | high | 1, 2 |
| 5 Motion | S to M | medium | 2 |
| 6 Responsive/classroom | M | medium | 3, 4 |
| 7 Product upgrades | ongoing | varies | 1 to 4 |

If time is short, do Phase 0, 1, 2 and the Home hero from Phase 3. That alone changes the first impression the most.

## 5. Decisions needed from the owner

1. **Direction:** is "lamplit study" (warm dark teal plus amber glow) the right mood, or do you want something brighter and more playful for kids?
2. **Piece set:** commission/draw an original set, or have me find a permissively licensed one and record its licence?
3. **Avatars and bot characters:** keep animals (fox, owl) as original illustrations, or move to chess-piece characters?
4. **Scope:** visual pass only (Phases 0 to 6), or continue into Phase 7 afterwards?
5. **Who tests it:** can you show Phase 2 and 3 to a real class or a few students before Phase 4 starts?

## 6. Guardrails (from AGENTS.md)

- No GPL/AGPL assets or code, including piece sets and icons; no copied content or likenesses of Chessly or GothamChess.
- All UI strings live in `src/i18n/en.ts`; shipped puzzle data stays under 25 MB; fonts and images must work offline.
- No test is skipped or loosened to get green; build with `implementer`, test with `test-engineer`, review with `code-reviewer` then `classroom-ui-reviewer`.

## 7. Status log

### 2026-10-27: Phase 0 and 1 (done, uncommitted)
Decisions taken from the owner's go-ahead: lamplit direction; piece set and avatar art deferred (original or licence-verified only); one-time scope was Phase 0 and 1.

**Phase 0**
- Baseline screenshots: 54 images in `docs/design/before/` (9 routes x desktop/tablet/phone x light/dark), kept local and not committed (about 3.5 MB); regenerate from the pre-Phase-1 commit if needed. After-shots: `docs/design/after-phase1/` (committed).
- Contrast (WCAG): text pairs all pass (body 14.3, muted 6.3, cream on ink 11.3, amber on ink 5.8, dark muted 7.5). Problems: amber as text on cream is 1.94, so amber is never text on light surfaces; the card border `line` on cream is 1.33 (decorative, now backed by a shadow).
- Budget at baseline: precache 3,541 KiB, main JS 79 KB gzip. After Phase 1: 3,623 KiB (+81, all fonts), main JS 80 KB gzip.
- `npm audit` reports 2 advisories (serialize-javascript, build-time PWA dependency); unrelated to this work, not changed.

**Phase 1** (fixes V4, V5, V10 in part, V13 in part)
- Fonts self-hosted and verified loaded (Fraunces and Nunito both `loaded`). New tokens in `src/index.css`.
- `icons.tsx` (sun, moon, monitor, volume, volume-off, menu, close, flame), `Avatar.tsx`, `Card.tsx` (hero/stat/plain/interactive); `Button` gets the radius scale, shadow and lamp-glow hover.
- Applied to: header (gradient, amber rule, icons), profile switcher, leaderboard avatars, Home (display title, stat and hero cards, flame).
- Gates: typecheck, lint, 537/537 unit tests, content validator, puzzle size all pass; build passes. Existing e2e suite not re-run, and it has known stale selectors (AUDIT_REPORT.md).

**Not done, still open from Phase 1:** the nav active-state indicator (moved to Phase 3), original SVG avatars, applying `Card` variants beyond Home (Courses, Puzzles, Play in Phases 3 and 4), RTL font fallback for Arabic (Nunito has no Arabic glyphs).

### 2026-10-28: Phase 2 first slice (board look, done, see DECISIONS.md)
- New default palette, ink frame with amber hairline, coral check glow; unit gates pass (537/537). E2E: 44 pass, 11 fail, all in `play.spec.ts` and `students.spec.ts` on stale selectors/copy (for example "Level 1: Sleepy Pawn" now reads "Opponent 1", avatar radios are not buttons); not caused by this change and not fixed here.
- Still open in Phase 2: piece-set licence or replacement (blocker for release), a board-theme picker UI with a high-contrast projector theme, a dark-mode board variant, and piece animation tuning.
