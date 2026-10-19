import { expect, test, type Page } from '@playwright/test';

async function openClassMode(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('#/puzzles?level=beginner&theme=mateIn1');
  await page.getByRole('button', { name: 'Class Mode' }).click();
  await expect(page.locator('.fixed.inset-0')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next puzzle (N)' })).toBeVisible();
}

test('Class Mode fits a 1366x768 projector without scrolling', async ({ page }) => {
  await openClassMode(page, 1366, 768);
  const box = await page.locator('.fixed.inset-0').evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(box.scroll).toBeLessThanOrEqual(box.client);
});

test('Class Mode keeps sound and Next fully visible at 820x1180 portrait', async ({ page }) => {
  await openClassMode(page, 820, 1180);
  const box = await page.locator('.fixed.inset-0').evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  const sound = await page.getByRole('button', { name: 'Sound effects' }).boundingBox();
  const next = await page.getByRole('button', { name: 'Next puzzle (N)' }).boundingBox();
  if (!sound || !next) throw new Error('controls not rendered');
  expect(sound.y + sound.height).toBeLessThanOrEqual(1180);
  expect(next.y + next.height).toBeLessThanOrEqual(1180);
  expect(box.scroll).toBeLessThanOrEqual(box.client);
});
