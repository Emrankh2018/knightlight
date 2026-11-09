import { expect, test } from '@playwright/test';

const oldLinks = ['#/games', '#/games/castle', '#/games/knight', '#/games/detective'];

for (const [width, height] of [[1366, 768], [390, 844]] as const) {
  test(`retired Games links are absent and Puzzles remains accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('#/');
    const home = page.getByRole('main');
    await expect(home.getByRole('heading', { name: /^Welcome back,/ })).toBeVisible();
    await expect(home.getByRole('link', { name: 'Play a chess adventure', exact: true })).toHaveCount(0);

    const header = page.getByRole('banner');
    if (width < 1280) await header.getByRole('button', { name: 'Open menu' }).click();
    await expect(header.getByRole('link', { name: 'Games', exact: true })).toHaveCount(0);
    await expect(page.locator('a[href^="#/games"]')).toHaveCount(0);
    await header.getByRole('link', { name: 'Puzzles', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Puzzles', exact: true })).toBeVisible();
  });
}

test('old Games bookmarks open Home', async ({ page }) => {
  for (const bookmark of oldLinks) {
    await page.goto(bookmark);
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('main').getByRole('heading', { name: /^Welcome back,/ })).toBeVisible();
  }
});
