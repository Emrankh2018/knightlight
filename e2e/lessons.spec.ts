import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type CatalogEntry = { slug: string; title: string; kind: string; tags: string[] };
const catalog = JSON.parse(readFileSync('public/data/courses/index.json', 'utf8')) as CatalogEntry[];
const listed = catalog.filter((c) => !c.tags.includes('sample'));
const hidden = catalog.filter((c) => c.tags.includes('sample'));

const LESSON = '#/learn/italian-game/first-moves';

const square = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);

async function openLesson(page: Page, hash: string): Promise<void> {
  await page.goto(hash);
  await expect(page.getByText(/^Step 1 of \d/)).toBeVisible();
}

/** Plays the explain moves one key press at a time; a press that the page was not ready for is repeated only while its move is not showing. */
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

test('Courses library hides the sample course and shows the friendly review badge', async ({ page }) => {
  expect(hidden.length).toBeGreaterThan(0);
  await page.goto('#/courses');
  const cards = page.getByRole('heading', { level: 2 });
  await expect(cards).toHaveCount(listed.length);
  for (const c of listed) await expect(page.getByRole('heading', { level: 2, name: c.title })).toBeVisible();
  for (const c of hidden) await expect(page.getByText(c.title)).toHaveCount(0);
  await expect(page.getByText('Sample: Attacking f7')).toHaveCount(0);
  await expect(page.getByText('Coach is still checking this course')).toHaveCount(listed.filter((c) => !(c as CatalogEntry & { reviewed?: boolean }).reviewed).length);
  await expect(page.getByText('Not yet reviewed by the coach')).toHaveCount(0);
  const openings = listed.filter((c) => c.kind === 'opening');
  const skills = listed.filter((c) => c.kind === 'skills');
  await page.getByRole('button', { name: 'Openings', exact: true }).click();
  await expect(cards).toHaveCount(openings.length);
  await expect(page.getByRole('heading', { level: 2, name: 'Italian Game for White' })).toBeVisible();
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  await expect(cards).toHaveCount(skills.length);
  await expect(page.getByText('Italian Game for White')).toHaveCount(0);
});

test('open italian-game, solve a find-move step and finish a lesson', async ({ page }) => {
  await page.goto('#/courses');
  await page.getByRole('link', { name: /^Start Italian Game for White/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Italian Game for White' })).toBeVisible();
  await expect(page.getByText('Key points')).toHaveCount(0);
  await page.getByRole('link', { name: /^Start The first moves/ }).click();

  // Explain step: step through the five moves with the keyboard.
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await stepMoves(page, 5);
  await page.getByRole('button', { name: 'Next step' }).click();

  // Find-move step: a wrong move shows feedback, the right one solves it.
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await play(page, 'd2', 'd4');
  await expect(page.getByRole('status').filter({ hasText: 'Not that one' })).toBeVisible();
  await page.keyboard.press('h');
  await expect(page.getByText('Hint 1 of 3')).toBeVisible();
  await play(page, 'g1', 'f3');
  await expect(page.getByText('Solved!')).toBeVisible();
  await page.keyboard.press('Enter');

  // Line drill: the opponent replies are played automatically.
  await expect(page.getByText('Step 3 of 3')).toBeVisible();
  const myTurn = page.getByText('White to move', { exact: true });
  await expect(myTurn).toBeVisible();
  await play(page, 'e2', 'e4');
  await expect(myTurn).toBeVisible();
  await play(page, 'g1', 'f3');
  await expect(myTurn).toBeVisible();
  await play(page, 'f1', 'c4');
  await expect(page.getByText(/Line complete!/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish lesson' }).click();

  await expect(page.getByText('Lesson complete!').first()).toBeVisible();
  await expect(page.getByText(/XP earned/)).toBeVisible();
  await expect(page.getByRole('link', { name: /^Next lesson:/ })).toBeVisible();

  await page.goto('#/courses/italian-game');
  await expect(page.getByText('Completed').first()).toBeVisible();
});

test('Teacher view is off by default and reveals the coach notes when switched on', async ({ page }) => {
  await page.goto(LESSON);
  const toggle = page.getByRole('button', { name: 'Teacher view' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('heading', { name: 'Teacher notes' })).toHaveCount(0);
  await toggle.click();
  await expect(page.getByRole('heading', { name: 'Teacher notes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Questions for the class' })).toBeVisible();
});

async function fits(page: Page): Promise<{ scroll: number; client: number }> {
  return page.locator('.fixed.inset-0').evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
}

test('Present mode fits a 1366x768 projector without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(LESSON);
  await page.getByRole('button', { name: 'Present', exact: true }).click();
  await expect(page.locator('.fixed.inset-0')).toBeVisible();
  let box = await fits(page);
  expect(box.scroll).toBeLessThanOrEqual(box.client);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await stepMoves(page, 5);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  box = await fits(page);
  expect(box.scroll).toBeLessThanOrEqual(box.client);
});

test('Present mode keeps the controls on screen at 820x1180 portrait', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(LESSON);
  await page.getByRole('button', { name: 'Present', exact: true }).click();
  await expect(page.locator('.fixed.inset-0')).toBeVisible();
  const box = await fits(page);
  expect(box.scroll).toBeLessThanOrEqual(box.client);
  const next = await page.getByRole('button', { name: 'Next step' }).boundingBox();
  if (!next) throw new Error('controls not rendered');
  expect(next.y + next.height).toBeLessThanOrEqual(1180);
});

test('students do not see the lesson-level mistakes tip after a wrong move; Teacher view lists it', async ({ page }) => {
  await openLesson(page, '#/learn/italian-game/first-moves');
  await stepMoves(page, 5);
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await play(page, 'd2', 'd4');
  await expect(page.getByRole('status').filter({ hasText: 'Not that one' })).toBeVisible();
  await expect(page.getByText('Watch out')).toHaveCount(0);
  await expect(page.getByText('Moving the same piece twice in the opening')).toHaveCount(0);
  await page.getByRole('button', { name: 'Teacher view' }).click();
  await expect(page.getByText('Moving the same piece twice in the opening')).toBeVisible();
});

test('a lesson finished only by showing the answer earns no lesson bonus', async ({ page }) => {
  await openLesson(page, '#/learn/italian-game/greed-trap');
  await stepMoves(page, 8);
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByText('Step 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByRole('button', { name: 'Finish lesson' }).click();
  await expect(page.getByText(/does not count yet/)).toBeVisible();
  await expect(page.getByText(/XP earned/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Next lesson:/ })).toBeVisible();
  await page.goto('#/courses/italian-game');
  const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: 'Do not rush to take f7' }) }).last();
  await expect(row.getByText('Not completed yet')).toBeVisible();
});

test('opening a lesson from a plain link starts at step 1; Restart lesson goes back', async ({ page }) => {
  await openLesson(page, LESSON);
  await stepMoves(page, 5);
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Restart lesson' }).click();
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
});

const QUIZ_LESSON = '#/learn/italian-game/development-goals';

async function openQuizPresent(page: Page): Promise<void> {
  await openLesson(page, QUIZ_LESSON);
  await stepMoves(page, 10);
  await page.getByRole('button', { name: 'Next step' }).click();
  await play(page, 'e1', 'g1');
  await expect(page.getByText('Solved!')).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByText('Step 3 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Present', exact: true }).click();
  await expect(page.locator('.fixed.inset-0')).toBeVisible();
}

for (const size of [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
]) {
  test(`Present quiz is fully visible and not covered at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openQuizPresent(page);
    const choices = page.getByRole('button', { name: /^Answer \d/ });
    const count = await choices.count();
    expect(count).toBeGreaterThanOrEqual(3);
    // Answer wrongly first, then correctly, so the banners and explanation are on screen too.
    await choices.first().click();
    await page.keyboard.press('2');
    const result = page.getByText('Correct!');
    await expect(result).toBeVisible();
    const targets = [choices.nth(count - 1), result, page.getByText('Why:'), page.getByRole('button', { name: 'Finish lesson' })];
    for (const target of targets) {
      const box = await target.boundingBox();
      if (!box) throw new Error('target not rendered');
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      const covered = await target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === null || !(el === hit || el.contains(hit));
      });
      expect(covered).toBe(false);
    }
  });
}

for (const size of [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
]) {
  test(`step controls are on screen without scrolling at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openLesson(page, LESSON);
    for (const name of ['Previous', 'Next step']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      if (!box) throw new Error(`${name} not rendered`);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    }
  });
}
