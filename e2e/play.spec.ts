import { expect, test, type Page } from '@playwright/test';

const square = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);

async function startGame(page: Page, side: 'White' | 'Black' = 'White'): Promise<void> {
  await page.goto('#/play');
  await expect(page.getByRole('heading', { name: 'Play against the bot', level: 1 })).toBeVisible();
  await page.getByRole('radio', { name: /Opponent 1: Sleepy Pawn/ }).check();
  await page.locator('label').filter({ has: page.getByRole('radio', { name: side }) }).click();
  await expect(page.getByRole('radio', { name: side })).toBeChecked();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('application')).toBeVisible();
}

async function play(page: Page, from: string, to: string): Promise<void> {
  await square(page, from).click();
  await square(page, to).click();
}

const yourTurn = (page: Page) => page.getByText('Your turn.');
const moveList = (page: Page) => page.getByRole('list', { name: 'Moves' });

test('the Play link is in the navigation', async ({ page }) => {
  await page.goto('#/');
  await page.getByRole('navigation', { name: 'Main navigation' }).first().getByRole('link', { name: 'Play' }).click();
  await expect(page.getByRole('radio', { name: /Wise Owl/ })).toBeAttached();
});

test('start as White at level 1, move, and the bot replies', async ({ page }) => {
  await startGame(page);
  await expect(yourTurn(page)).toBeVisible();
  await play(page, 'e2', 'e4');
  await expect(moveList(page).getByRole('listitem').first()).toContainText(/^1\.e4.+/, { timeout: 15000 });
  await expect(yourTurn(page)).toBeVisible();
});

test('playing Black lets the bot open', async ({ page }) => {
  await startGame(page, 'Black');
  await expect(moveList(page).getByRole('listitem').first()).toContainText(/^1\.\S+/, { timeout: 15000 });
  await expect(yourTurn(page)).toBeVisible();
});

test('Undo takes back the move and the reply', async ({ page }) => {
  await startGame(page);
  await play(page, 'e2', 'e4');
  await expect(moveList(page).getByRole('listitem').first()).toContainText(/^1\.e4.+/, { timeout: 15000 });
  await expect(yourTurn(page)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('No moves yet.')).toBeVisible();
  await expect(yourTurn(page)).toBeVisible();
});

test('Give up asks first, then shows a gentle result with no XP', async ({ page }) => {
  await startGame(page);
  await play(page, 'e2', 'e4');
  await expect(moveList(page).getByRole('listitem').first()).toContainText(/^1\.e4.+/, { timeout: 15000 });
  await expect(yourTurn(page)).toBeVisible();
  await play(page, 'g1', 'f3');
  await expect(moveList(page).getByRole('listitem')).toHaveCount(2, { timeout: 15000 });
  await expect(yourTurn(page)).toBeVisible();
  await page.getByRole('button', { name: 'Give up' }).click();
  await expect(page.getByText('Give up this game?')).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByText('Give up this game?')).toHaveCount(0);
  await page.getByRole('button', { name: 'Give up' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByRole('heading', { name: 'Good game' })).toBeVisible();
  await expect(page.getByText('You gave up this game.')).toBeVisible();
  await expect(page.getByText(/XP$/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Change opponent' }).click();
  await expect(page.getByRole('button', { name: 'Start game' })).toBeVisible();
});

test('resigning at once earns no XP', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Give up' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByRole('heading', { name: 'Good game' })).toBeVisible();
  await expect(page.getByText(/XP$/)).toHaveCount(0);
});

test('a hint draws an arrow and uses up one of three', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Hint (3 left)' }).click();
  await expect(page.getByRole('button', { name: 'Hint (2 left)' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/^Hint: try moving from [a-h][1-8] to [a-h][1-8]\.$/)).toBeVisible();
});
