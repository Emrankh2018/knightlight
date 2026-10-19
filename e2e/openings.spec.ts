import { expect, test } from '@playwright/test';

test('playing 1.e4 e5 2.Nf3 Nc6 3.Bc4 shows Italian Game', async ({ page }) => {
  await page.goto('#/openings');
  await expect(page.getByRole('heading', { name: 'Openings explorer' })).toBeVisible();
  const play = async (name: string): Promise<void> => {
    await page.getByRole('button', { name: new RegExp(`^Play ${name},`) }).click();
  };
  await play('e4');
  await play('e5');
  await play('Nf3');
  await play('Nc6');
  await play('Bc4');
  await expect(page.getByText('Italian Game', { exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(/moves=e4%2Ce5%2CNf3%2CNc6%2CBc4/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Italian Game', { exact: true })).toHaveCount(0);
});

test('deep link loads the line and search loads an opening', async ({ page }) => {
  await page.goto('#/openings?moves=e4,c5,bogus');
  await expect(page.getByRole('button', { name: 'Move 2: c5' })).toBeVisible();
  await page.getByLabel('Search by name, ECO code or moves').fill('italian game');
  await page.getByRole('button', { name: /^Show on the board: Italian Game$/ }).click();
  await expect(page.getByRole('button', { name: 'Move 5: Bc4' })).toBeVisible();
});

test('loading bad text shows a kind error', async ({ page }) => {
  await page.goto('#/openings');
  await page.getByText('Load a game (for the coach)').click();
  await page.getByLabel('Paste a FEN position or a PGN game').fill('not chess');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not read');
});

test('clicking squares plays a legal move and rejects an illegal one', async ({ page }) => {
  await page.goto('#/openings');
  const sq = (s: string) => page.locator(`[data-square="${s}"]`);
  await sq('e2').click();
  await sq('e4').click();
  await expect(page.getByRole('button', { name: 'Move 1: e4' })).toBeVisible();
  await sq('e7').click();
  await sq('e3').click();
  await expect(page.getByRole('button', { name: /^Move 2:/ })).toHaveCount(0);
});

test('the board is a single Tab stop between the header and the side panel', async ({ page }) => {
  await page.goto('#/openings');
  await expect(page.getByRole('application')).toBeVisible();
  await page.locator('header').first().locator('a:visible, button:visible').last().focus();
  let presses = 0;
  for (; presses < 10; presses++) {
    await page.keyboard.press('Tab');
    const inPanel = await page.evaluate(() => {
      const el = document.activeElement;
      return el !== null && el.closest('main') !== null && el.closest('[role="application"]') === null;
    });
    if (inPanel) break;
  }
  expect(presses + 1).toBeLessThanOrEqual(3);
});

test('board keyboard plays a move and the link can change the line', async ({ page }) => {
  await page.goto('#/openings');
  await page.locator('[role="application"]').focus();
  for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'ArrowUp', 'Enter']) await page.keyboard.press(k);
  await expect(page.getByRole('button', { name: 'Move 1: a4' })).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '#/openings?moves=c4';
  });
  await expect(page.getByRole('button', { name: 'Move 1: c4' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move 1: a4' })).toHaveCount(0);
});

test('focus stays on the page after playing a book move and after Undo', async ({ page }) => {
  await page.goto('#/openings');
  await page.getByRole('button', { name: /^Play e4,/ }).click();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Undo' }).press('Enter');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
});
