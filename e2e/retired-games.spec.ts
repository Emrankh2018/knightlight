import { expect, test } from '@playwright/test';

const oldLinks = ['#/games/castle', '#/games/knight', '#/games/detective'];
const currentGames = ['Boss Battle', 'Combo Chess', 'Build Your Own Army'];

for (const [width, height] of [[1366, 768], [390, 844]] as const) {
  test(`the new Games hub and Puzzles are reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('#/');
    const home = page.getByRole('main');
    await expect(home.getByRole('heading', { name: /^Welcome back,/ })).toBeVisible();
    await expect(home.getByRole('link', { name: 'Play a chess adventure', exact: true })).toHaveCount(0);

    const header = page.getByRole('banner');
    if (width < 1280) await header.getByRole('button', { name: 'Open menu' }).click();
    await header.getByRole('link', { name: 'Puzzles', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Puzzles', exact: true })).toBeVisible();

    if (width < 1280) await header.getByRole('button', { name: 'Open menu' }).click();
    await header.getByRole('link', { name: 'Games', exact: true }).click();
    await expect(home.getByRole('heading', { name: 'Games', exact: true })).toBeVisible();
    await expect(home.getByRole('heading', { level: 2 })).toHaveText(currentGames);
    for (const oldLink of oldLinks) await expect(page.locator(`a[href="${oldLink}"]`)).toHaveCount(0);
  });
}

test('old Games bookmarks open Home', async ({ page }) => {
  for (const bookmark of oldLinks) {
    await page.goto(bookmark);
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('main').getByRole('heading', { name: /^Welcome back,/ })).toBeVisible();
  }
});

test('Home launches the new Games hub', async ({ page }) => {
  await page.goto('#/');
  await page.getByRole('link', { name: 'Play chess games' }).click();
  await expect(page).toHaveURL(/#\/games$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(currentGames);
});
