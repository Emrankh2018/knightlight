import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface PuzzleFile {
  id: string;
  moves: string[];
}

const bucket = JSON.parse(readFileSync('public/data/puzzles/beginner/mateIn1.json', 'utf8')) as PuzzleFile[];

const square = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);

/** Ids of the puzzle SRS items stored for the active profile. */
async function queuedPuzzleIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ids: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('knightlight:v1:profile:') || key.endsWith(':backup')) continue;
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
      const srs = (parsed as { srs?: Record<string, { kind: string; ref: string }> }).srs ?? {};
      for (const item of Object.values(srs)) if (item.kind === 'puzzle') ids.push(item.ref);
    }
    return ids;
  });
}

test('Review is empty at first and a missed puzzle can be solved out of the queue', async ({ page }) => {
  await page.goto('#/review');
  await expect(page.getByText('Nothing to review — great job!')).toBeVisible();

  // Miss a puzzle by asking for the solution.
  await page.goto('#/puzzles?level=beginner&theme=mateIn1');
  await expect(page.getByRole('application')).toBeVisible();
  await page.getByRole('button', { name: 'Show solution (S)' }).click();
  await expect(page.getByText('Here is the solution.')).toBeVisible();

  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await expect(page.getByText('1 due today')).toBeVisible();
  const [id] = await queuedPuzzleIds(page);
  const puzzle = bucket.find((p) => p.id === id);
  expect(puzzle).toBeDefined();
  const solution = puzzle?.moves[1] ?? '';

  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('application')).toBeFocused();
  await page.getByRole('button', { name: 'Class Mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-class-mode', '');
  await square(page, solution.slice(0, 2)).click();
  await square(page, solution.slice(2, 4)).click();
  await expect(page.getByText('Solved!')).toBeVisible();
  await page.getByRole('button', { name: 'Next puzzle (N)' }).click();

  await expect(page.getByText('Review finished. Nicely done!')).toBeVisible();
  await expect(page.getByText('Next review: tomorrow.')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-class-mode');

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page.getByText('No reviews due today.')).toBeVisible();
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await expect(page.getByText('Nothing to review — great job!')).toBeVisible();
});

test('Review has no horizontal overflow at 820x1180', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('#/review');
  await expect(page.getByRole('heading', { level: 1, name: 'Review' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

/** Steps through the explain moves; a press the page was not ready for is repeated only while its move is not showing. */
async function stepMoves(page: Page, count: number): Promise<void> {
  for (let i = 1; i <= count; i++) {
    const shown = page.getByText(new RegExp(`^Move ${i} of`));
    await expect(async () => {
      if (!(await shown.isVisible())) await page.keyboard.press('ArrowRight');
      await expect(shown).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
  }
}

async function play(page: Page, from: string, to: string): Promise<void> {
  await square(page, from).click();
  await square(page, to).click();
}

test('A line drilled with a mistake comes back in Review', async ({ page }) => {
  await page.goto('#/learn/italian-game/first-moves');
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await stepMoves(page, 5);
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await play(page, 'g1', 'f3');
  await expect(page.getByText('Solved!')).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();

  await expect(page.getByText('Step 3 of 3')).toBeVisible();
  const myTurn = page.getByText('White to move', { exact: true });
  await expect(myTurn).toBeVisible();
  await play(page, 'd2', 'd4');
  await expect(page.getByRole('status').filter({ hasText: 'Not that one' })).toBeVisible();
  await play(page, 'e2', 'e4');
  await expect(myTurn).toBeVisible();
  await play(page, 'g1', 'f3');
  await expect(myTurn).toBeVisible();
  await play(page, 'f1', 'c4');
  await expect(page.getByText(/Line complete!/)).toBeVisible();

  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await expect(page.getByText('1 due today')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Question 1 of 1', { exact: false })).toBeVisible();
  await expect(myTurn).toBeVisible();
  await play(page, 'e2', 'e4');
  await expect(myTurn).toBeVisible();
  await play(page, 'g1', 'f3');
  await expect(myTurn).toBeVisible();
  await play(page, 'f1', 'c4');
  await expect(page.getByText(/Line complete!/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Review finished. Nicely done!')).toBeVisible();
});

const NOT_FOUND = { status: 404, contentType: 'text/plain', body: 'Not Found' };
const LINE_REF = 'italian-game/01-the-setup/first-moves/2';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface Seed {
  id: string;
  kind: 'puzzle' | 'line';
  ref: string;
}

/** Adds due SRS items to the active profile and reloads so the store picks them up. */
async function seedDue(page: Page, items: Seed[]): Promise<void> {
  await page.goto('#/');
  await page.evaluate((seeds) => {
    const day = new Date();
    const due = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const profiles = JSON.parse(localStorage.getItem('knightlight:v1:profiles') ?? '{}') as { activeId?: string };
    const key = `knightlight:v1:profile:${profiles.activeId ?? ''}`;
    const empty = {
      version: 1,
      xp: 0,
      streak: { current: 0, best: 0 },
      completedSteps: {},
      completedLessons: {},
      puzzles: { solved: {}, byLevel: {}, streak: { current: 0, best: 0 } },
      srs: {},
      achievements: [],
      botWins: {},
      linesDrilled: 0,
    };
    const parsed = JSON.parse(localStorage.getItem(key) ?? JSON.stringify(empty)) as typeof empty;
    for (const s of seeds) parsed.srs = { ...parsed.srs, [s.id]: { ...s, ease: 2.5, interval: 0, reps: 0, due, lapses: 0 } };
    localStorage.setItem(key, JSON.stringify(parsed));
  }, items);
  await page.reload();
}

async function queuedIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ids: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('knightlight:v1:profile:') || key.endsWith(':backup')) continue;
      const srs = (JSON.parse(localStorage.getItem(key) ?? '{}') as { srs?: Record<string, unknown> }).srs ?? {};
      ids.push(...Object.keys(srs));
    }
    return ids;
  });
}

test('A 404 course is dropped from the queue; a server error is only skipped', async ({ page }) => {
  await page.route('**/data/courses/gone-course.json', (route) => route.fulfill(NOT_FOUND));
  await page.route('**/data/courses/flaky-course.json', (route) => route.fulfill({ status: 500, body: 'oops' }));
  await seedDue(page, [
    { id: 'line:gone-course/x', kind: 'line', ref: 'gone-course/x' },
    { id: 'line:flaky-course/x', kind: 'line', ref: 'flaky-course/x' },
  ]);
  await page.goto('#/review');
  await expect(page.getByText('2 due today')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Nothing could be reviewed this time.')).toBeVisible();
  await expect(page.getByText('Some items are no longer available and were removed from your list.')).toBeVisible();
  await expect(page.getByText('Some items could not be loaded. They stay in your list for next time.')).toBeVisible();
  await expect.poll(() => queuedIds(page)).toEqual(['line:flaky-course/x']);
});

test('A failing puzzle index does not stop the line items', async ({ page }) => {
  await page.route('**/data/puzzles/index.json', (route) => route.fulfill({ status: 500, body: 'oops' }));
  await seedDue(page, [
    { id: 'puzzle:p1', kind: 'puzzle', ref: 'p1' },
    { id: `line:${LINE_REF}`, kind: 'line', ref: LINE_REF },
  ]);
  await page.goto('#/review');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Question 1 of 1', { exact: false })).toBeVisible();
  await expect(page.getByText('Some items could not be loaded. They stay in your list for next time.')).toBeVisible();
  await expect.poll(() => queuedIds(page)).toContain('puzzle:p1');
});

test('A corrupt puzzle is dropped and the empty result is not reported as all done', async ({ page }) => {
  const corrupt = [{ id: 'corrupt1', fen: START_FEN, moves: ['e2e5', 'e7e5'], rating: 1000, themes: [], url: '' }];
  await page.route(/\/data\/puzzles\/(?!index\.json)[^/]+\/[^/]+\.json$/, (route) => route.fulfill({ json: corrupt }));
  await seedDue(page, [{ id: 'puzzle:corrupt1', kind: 'puzzle', ref: 'corrupt1' }]);
  await page.goto('#/review');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Nothing could be reviewed this time.')).toBeVisible();
  await expect(page.getByText('Nothing to review — great job!')).toHaveCount(0);
  await expect.poll(() => queuedIds(page)).toEqual([]);
});
