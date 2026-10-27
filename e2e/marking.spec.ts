import { expect, test, type Page } from '@playwright/test';

const sq = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);
const GREEN = /rgba\(59, 178, 115/;

for (const [name, hash] of [
  ['a puzzle board', '#/puzzles?level=beginner&theme=mateIn1'],
  ['a lesson board', '#/learn/italian-game/first-moves'],
  ['the play board', '#/play'],
] as const) {
  test(`right-click marks a square on ${name} with no mode switch, and a left click clears it`, async ({ page }) => {
    await page.goto(hash);
    if (name === 'the play board') await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.locator('[data-square="e4"]')).toBeVisible();
    expect(await page.getByRole('button', { name: 'Mark mode' }).count()).toBe(0);
    await sq(page, 'e4').click({ button: 'right' });
    await expect(sq(page, 'e4').locator('> div')).toHaveCSS('background-color', GREEN);
    await sq(page, 'h5').click();
    await expect(sq(page, 'e4').locator('> div')).not.toHaveCSS('background-color', GREEN);
  });
}
