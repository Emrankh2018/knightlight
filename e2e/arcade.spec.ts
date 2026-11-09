import { expect, test, type Page } from '@playwright/test';

function square(page: Page, name: string) {
  return page.locator(`[data-square="${name}"]`);
}

async function move(page: Page, from: string, to: string) {
  await expect(square(page, from).locator('[data-piece]')).toBeVisible();
  await square(page, from).click();
  await square(page, to).click();
}

test('Boss Battle respawns the queen, adds her final-life guards, and can be replayed', async ({ page }) => {
  await page.goto('#/games');
  await page.getByRole('link', { name: 'Play Boss Battle' }).click();
  await page.getByRole('link', { name: 'Pass and play' }).click();
  const board = page.getByRole('application', { name: /Boss Battle chessboard/ });
  await expect(board).toHaveAttribute('tabindex', '0');
  await expect(page.getByText('3 of 3', { exact: true })).toBeVisible();
  await move(page, 'd4', 'd8');
  await expect(page.getByText('2 of 3', { exact: true })).toBeVisible();
  await move(page, 'a7', 'a8');
  await move(page, 'd8', 'a8');
  await expect(page.getByText('1 of 3', { exact: true })).toBeVisible();
  await expect(board).toHaveAccessibleName(/Black: Queen d8, Pawns c7, f7/);
  await move(page, 'd8', 'b8');
  await move(page, 'a8', 'b8');
  await expect(page.getByText('You beat the boss!', { exact: true })).toBeVisible();
  await expect(board).toHaveAttribute('tabindex', '-1');
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByText('3 of 3', { exact: true })).toBeVisible();
  await expect(board).toHaveAccessibleName(/White to move.*Black: Queen d8/);
});

test('Combo Chess takes keyboard moves, chains three captures, and stops after five', async ({ page }) => {
  await page.goto('#/games/combo?mode=local');
  const board = page.getByRole('application', { name: /Combo Chess board/ });
  await board.focus();
  await board.press('ArrowRight');
  await board.press('ArrowRight');
  await board.press('Enter');
  for (let i = 0; i < 5; i += 1) await board.press('ArrowRight');
  for (let i = 0; i < 5; i += 1) await board.press('ArrowUp');
  await board.press('Enter');
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  await move(page, 'c7', 'c6');
  await move(page, 'h6', 'g7');
  const end = page.getByRole('button', { name: 'End turn' });
  await expect(end).toBeVisible();
  await move(page, 'g7', 'f8');
  await move(page, 'f8', 'e7');
  await expect(page.getByText('White: 3 of 5 captures', { exact: true })).toBeVisible();
  await expect(end).toHaveCount(0);
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  for (const [from, to] of [['c6', 'c5'], ['e7', 'd6'], ['a8', 'b8'], ['d6', 'c5'], ['c5', 'a7']] as const) await move(page, from, to);
  await expect(page.getByText('White wins with five captures!', { exact: true })).toBeVisible();
  await expect(board).toHaveAttribute('tabindex', '-1');
});

test('the army draft hides the first choice, respects the budget, and ends at checkmate', async ({ page }) => {
  await page.goto('#/games/army?mode=local');
  const lock = page.getByRole('button', { name: 'Lock in army' });
  await expect(lock).toBeDisabled();
  await page.getByRole('button', { name: 'Add Queen' }).click();
  await expect(page.getByRole('button', { name: 'Add Knight' })).toBeDisabled();
  await expect(page.getByText('0 of 9 points left', { exact: true })).toBeVisible();
  await lock.click();
  await expect(page.getByRole('heading', { name: 'White’s army is locked in' })).toBeVisible();
  await expect(page.getByRole('application')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove Queen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Build Black’s army' }).click();
  await expect(page.getByRole('button', { name: 'Remove Queen' })).toBeDisabled();
  await expect(lock).toBeDisabled();
  await page.getByRole('button', { name: 'Add Rook' }).click();
  await page.getByRole('button', { name: 'Add Knight' }).click();
  await lock.click();
  const board = page.getByRole('application', { name: /Army match chessboard/ });
  await expect(board).toHaveAccessibleName(/Queen d1.*Rook a8, Knight b8/);
  for (const [from, to] of [['d1', 'b3'], ['b8', 'c6'], ['b3', 'g8']] as const) await move(page, from, to);
  await expect(page.getByText('White wins by checkmate!', { exact: true })).toBeVisible();
  await expect(board).toHaveAttribute('tabindex', '-1');
  await page.getByRole('button', { name: 'Draft new armies' }).click();
  await expect(page.getByRole('heading', { name: 'Build the White army' })).toBeVisible();
  await expect(lock).toBeDisabled();
});

for (const { game, label, from, to } of [
  { game: 'boss', label: 'Boss Battle chessboard', from: 'd4', to: 'd8' },
  { game: 'combo', label: 'Combo Chess board', from: 'c1', to: 'h6' },
  { game: 'army', label: 'Army match chessboard', from: 'e2', to: 'e4' },
]) {
  test(`${game} computer mode replies and hands control back to White`, async ({ page }) => {
    await page.goto(`#/games/${game}?mode=computer`);
    if (game === 'army') {
      await page.getByRole('button', { name: 'Add Queen' }).click();
      await page.getByRole('button', { name: 'Lock in army' }).click();
    }
    const board = page.getByRole('application', { name: new RegExp(label) });
    await expect(board).toHaveAttribute('tabindex', '0');
    await move(page, from, to);
    await expect(board).toHaveAccessibleName(/Black to move/);
    await expect(board).toHaveAttribute('tabindex', '-1');
    await expect(board).toHaveAccessibleName(/White to move/);
    await expect(board).toHaveAttribute('tabindex', '0');
  });
}

test.describe('arcade board on touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('touch moves work and only edge squares have coordinate text', async ({ page }) => {
    await page.goto('#/games/boss?mode=local');
    const board = page.getByRole('application', { name: /Boss Battle chessboard/ });
    const squares = board.locator('[data-square]');
    await expect(squares).toHaveCount(64);
    const labels = await squares.evaluateAll((cells) => cells.flatMap((cell) => {
      const text = (cell.textContent ?? '').trim().toLowerCase();
      return text ? [[cell.getAttribute('data-square'), text]] : [];
    }));
    expect(labels.map(([cell]) => cell).sort()).toEqual([
      'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1',
    ]);
    expect(labels.map(([, text]) => text).join('').split('').sort().join('')).toBe('12345678abcdefgh');
    await square(page, 'd4').tap();
    await square(page, 'd8').tap();
    await expect(page.getByText('2 of 3', { exact: true })).toBeVisible();
  });
});
