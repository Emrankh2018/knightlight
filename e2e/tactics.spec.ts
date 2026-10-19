import { expect, test } from '@playwright/test';

test('Tactics hub renders theme cards and Practise opens the puzzle board', async ({ page }) => {
  await page.goto('#/tactics');
  await expect(page.getByRole('heading', { level: 1, name: 'Tactics' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Fork' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(14);
  await page.getByRole('link', { name: /^Practise Fork, beginner/ }).click();
  await expect(page).toHaveURL(/#\/puzzles\?level=beginner&theme=fork/);
  await expect(page.getByRole('application').first()).toBeVisible();
});

test('Tactics hub has no horizontal overflow at 820x1180', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('#/tactics');
  await expect(page.getByRole('heading', { level: 2, name: 'Pin' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Puzzle board is a single Tab stop', async ({ page }) => {
  await page.goto('#/puzzles?level=beginner&theme=mateIn1');
  await expect(page.getByRole('application')).toBeVisible();
  const stops = await page.locator('[role="application"] [tabindex="0"]').count();
  expect(stops).toBe(0);
});
