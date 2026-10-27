import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const dialog = (page: Page) => page.getByRole('dialog');

async function addStudent(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Add a student' }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByLabel('Name').fill(name);
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await expect(dialog(page)).toBeHidden();
}

test('add a student, reject a duplicate, then switch between students', async ({ page }) => {
  await page.goto('#/students');
  await expect(page.getByRole('heading', { level: 1, name: 'Students' })).toBeVisible();
  await expect(page.getByText(/never sent anywhere/)).toBeVisible();

  const add = page.getByRole('button', { name: 'Add a student' });
  await add.click();
  await expect(dialog(page).getByLabel('Name')).toBeFocused();
  await dialog(page).getByRole('radio', { name: 'Choose avatar 🐼' }).click();
  await dialog(page).getByLabel('Name').fill('  Maya   Lee ');
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(add).toBeFocused();
  await expect(page.getByRole('status').first()).toContainText('Added Maya Lee');
  await expect(page.getByRole('heading', { level: 3, name: 'Maya Lee' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Student: Maya Lee, level 1/ })).toBeVisible();

  await add.click();
  await dialog(page).getByLabel('Name').fill('maya lee');
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('Another student already has that name.');
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog(page)).toBeHidden();

  await page.getByRole('button', { name: 'Make Player 1 the active student' }).click();
  await expect(page.getByRole('button', { name: /^Student: Player 1, level 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make Maya Lee the active student' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit Maya Lee' }).click();
  await dialog(page).getByLabel('Name').fill('Maya');
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Maya', exact: true })).toBeVisible();
});

test('delete asks first, focuses Cancel, and Escape keeps the student', async ({ page }) => {
  await page.goto('#/students');
  await addStudent(page, 'Maya');
  const del = page.getByRole('button', { name: 'Delete Maya' });
  await del.click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('heading', { name: 'Delete Maya?' })).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(del).toBeFocused();
  await expect(page.getByRole('heading', { level: 3, name: 'Maya' })).toBeVisible();

  await del.click();
  await dialog(page).getByRole('button', { name: 'Delete student' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole('heading', { level: 3, name: 'Maya' })).toHaveCount(0);
  await expect(page.getByRole('status').first()).toContainText('Deleted Maya.');
});

test('the last student cannot be deleted', async ({ page }) => {
  await page.goto('#/students');
  const del = page.getByRole('button', { name: 'Delete Player 1' });
  await expect(del).toBeDisabled();
  await expect(del).toHaveAccessibleDescription('At least one student must stay on this device.');
  await del.click({ force: true });
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByText('At least one student must stay on this device.')).toBeVisible();
});

test('reset progress asks first and zeroes XP', async ({ page }) => {
  await page.goto('#/students');
  await page.evaluate(() => {
    const profiles = JSON.parse(localStorage.getItem('knightlight:v1:profiles') ?? '{}') as { activeId: string };
    localStorage.setItem(
      `knightlight:v1:profile:${profiles.activeId}`,
      JSON.stringify({
        version: 1,
        xp: 120,
        streak: { current: 0, best: 0 },
        completedSteps: {},
        completedLessons: {},
        puzzles: { solved: {}, byLevel: {}, streak: { current: 0, best: 0 } },
        srs: {},
        achievements: [],
        botWins: {},
        linesDrilled: 0,
      }),
    );
  });
  await page.reload();
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: 'Player 1' }) });
  await expect(card.getByText('120', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reset progress for Player 1' }).click();
  await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(card.getByText('120', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reset progress for Player 1' }).click();
  await dialog(page).getByRole('button', { name: "Yes, reset Player 1's progress" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(card.getByText('120', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('status').first()).toContainText('Progress for Player 1 was reset.');
});

test('export then import restores a deleted student after a preview and confirm', async ({ page }) => {
  await page.goto('#/students');
  await addStudent(page, 'Maya');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^knightlight-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const text = readFileSync(path, 'utf8');
  expect(JSON.parse(text)).toMatchObject({ app: 'knightlight', version: 1 });

  await page.getByRole('button', { name: 'Delete Maya' }).click();
  await dialog(page).getByRole('button', { name: 'Delete student' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Maya' })).toHaveCount(0);

  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(dialog(page).getByRole('heading', { name: 'Import this backup?' })).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(dialog(page).getByText(/^Maya: level 1/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Maya' })).toHaveCount(0);

  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Maya' })).toHaveCount(0);

  await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await dialog(page).getByRole('button', { name: 'Replace everything' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole('heading', { level: 3, name: 'Maya' })).toBeVisible();
  await expect(page.getByText('Backup imported. 2 students restored.')).toBeVisible();
});

test('a bad import changes nothing and says why', async ({ page }) => {
  await page.goto('#/students');
  await addStudent(page, 'Maya');
  const input = page.locator('input[type="file"]');
  const alert = page.getByRole('alert').filter({ hasText: 'Nothing was changed' });

  await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{not json') });
  await expect(alert).toContainText('not valid JSON');

  await input.setInputFiles({ name: 'v9.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'knightlight', version: 9 })) });
  await expect(alert).toContainText('different version of Knightlight');

  await input.setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(5 * 1024 * 1024 + 10, 32) });
  await expect(alert).toContainText('too large');

  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole('heading', { level: 3, name: 'Maya' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Player 1' })).toBeVisible();
});

test('leaderboard sorts and the projector view hides the site chrome', async ({ page }) => {
  await page.goto('#/students');
  await addStudent(page, 'Maya');
  const xp = page.getByRole('button', { name: 'XP', exact: true });
  await expect(xp).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Streak', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Leaderboard, sorted by Streak, highest first' })).toBeVisible();

  await page.getByRole('button', { name: 'Projector view' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-class-mode', '');
  await expect(page.getByRole('table')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveAttribute('data-class-mode', '');
  await expect(page.getByRole('heading', { level: 1, name: 'Students' })).toBeVisible();
});

test('an assign link opens the right puzzle set', async ({ page }) => {
  await page.goto('#/assign?type=puzzles&level=beginner&theme=fork');
  await expect(page.getByText('Solve Beginner puzzles about: Fork.')).toBeVisible();
  const start = page.getByRole('link', { name: 'Start the puzzles' });
  await expect(start).toBeFocused();
  await start.click();
  await expect(page).toHaveURL(/#\/puzzles\?level=beginner&theme=fork/);
  await expect(page.getByRole('application').first()).toBeVisible();
});

test('an assign link opens the right lesson', async ({ page }) => {
  await page.goto('#/assign?type=lesson&id=tactics-basics/knight-fork');
  await expect(page.getByText('Do the lesson "The knight fork".')).toBeVisible();
  await page.getByRole('link', { name: 'Start the lesson' }).click();
  await expect(page).toHaveURL(/#\/learn\/tactics-basics\/knight-fork/);
});

test('bad assign links explain the problem', async ({ page }) => {
  for (const hash of ['#/assign', '#/assign?type=puzzles&level=beginner&theme=nope', '#/assign?type=lesson&id=../../x', '#/assign?type=lesson&id=tactics-basics/nope']) {
    await page.goto(hash);
    await page.reload();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse puzzles' })).toBeVisible();
  }
});

test('the assign link helper builds a link that opens the assignment', async ({ page }) => {
  await page.goto('#/students');
  await page.getByLabel('Level', { exact: true }).selectOption('beginner');
  await page.getByLabel('Theme', { exact: true }).selectOption('fork');
  await expect(page.getByRole('textbox', { name: 'Assign link' })).toHaveValue(/#\/assign\?type=puzzles&level=beginner&theme=fork$/);

  await page.getByRole('button', { name: 'A lesson' }).click();
  await page.getByLabel('Course').selectOption('tactics-basics');
  await page.getByLabel('Lesson', { exact: true }).selectOption('knight-fork');
  await expect(page.getByRole('textbox', { name: 'Assign link' })).toHaveValue(/#\/assign\?type=lesson&id=tactics-basics%2Fknight-fork$/);

  await page.getByRole('link', { name: 'Try the link' }).click();
  await expect(page).toHaveURL(/#\/assign\?type=lesson&id=tactics-basics%2Fknight-fork/);
  await expect(page.getByText('Do the lesson "The knight fork".')).toBeVisible();
});

test('Students has no horizontal overflow at 820x1180', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('#/students');
  await addStudent(page, 'A very long student name here');
  await expect(page.getByRole('heading', { level: 2, name: 'Make an assign link' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
