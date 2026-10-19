import { expect, test, type Page } from '@playwright/test';

const sq = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);

async function playByClick(page: Page, from: string, to: string): Promise<void> {
  await sq(page, from).click();
  await sq(page, to).click();
}

async function center(page: Page, s: string): Promise<{ x: number; y: number }> {
  const box = await sq(page, s).boundingBox();
  if (!box) throw new Error(`square ${s} not rendered`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const italian = (page: Page) => page.getByRole('status').filter({ hasText: 'Italian Game' });

test.beforeEach(async ({ page }) => {
  await page.goto('#/teacher');
  await expect(page.getByRole('heading', { name: 'Teacher analysis board' })).toBeVisible();
});

test('teacher page is in the nav and plays both sides, undo, redo and names the opening', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Teacher', exact: true }).first()).toBeVisible();
  await playByClick(page, 'e2', 'e4');
  await playByClick(page, 'e7', 'e5');
  await playByClick(page, 'g1', 'f3');
  await playByClick(page, 'b8', 'c6');
  await playByClick(page, 'f1', 'c4');
  await expect(page.getByRole('button', { name: 'Move 5: Bc4' })).toBeVisible();
  await expect(italian(page)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(italian(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(italian(page)).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('button', { name: /^Move 1:/ })).toHaveCount(0);
});

test('a loaded FEN sets the position and names it', async ({ page }) => {
  await page.getByText('Load a game (for the coach)').click();
  const box = page.getByLabel('Paste a FEN position or a PGN game');
  await box.fill('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.getByText('Loaded.')).toBeVisible();
  await expect(italian(page)).toBeVisible();
  await expect(page.getByText('Black to move').first()).toBeVisible();
  await box.fill('nonsense');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not read');
});

test('right-drag draws an arrow, right-click marks a square, a move or Clear removes them', async ({ page }) => {
  const clear = page.getByRole('button', { name: 'Clear drawings' });
  await expect(clear).toHaveAttribute('aria-disabled', 'true');
  const a = await center(page, 'g1');
  const b = await center(page, 'f3');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await expect(clear).toHaveAttribute('aria-disabled', 'false');
  await sq(page, 'd5').click({ button: 'right' });
  await expect(sq(page, 'd5').locator('> div')).toHaveCSS('background-color', /rgba\(59, 178, 115/);
  await clear.click();
  await expect(clear).toHaveAttribute('aria-disabled', 'true');
  await expect(sq(page, 'd5').locator('> div')).not.toHaveCSS('background-color', /rgba\(59, 178, 115/);

  await sq(page, 'd5').click({ button: 'right' });
  await expect(clear).toHaveAttribute('aria-disabled', 'false');
  await playByClick(page, 'e2', 'e4');
  await expect(clear).toHaveAttribute('aria-disabled', 'true');
});

test('mark mode marks squares with the left button and does not move pieces', async ({ page }) => {
  await page.getByRole('button', { name: 'Mark mode' }).click();
  await sq(page, 'e2').click();
  await sq(page, 'e4').click();
  await expect(page.getByRole('button', { name: /^Move 1:/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear drawings' })).toHaveAttribute('aria-disabled', 'false');
  await page.getByRole('button', { name: 'Mark mode' }).click();
  await playByClick(page, 'e2', 'e4');
  await expect(page.getByRole('button', { name: 'Move 1: e4' })).toBeVisible();
});

test('teacher notes persist for the session and the board is a single tab stop', async ({ page }) => {
  await page.getByLabel('Notes for this session').fill('Ask about the fork');
  await page.reload();
  await expect(page.getByLabel('Notes for this session')).toHaveValue('Ask about the fork');
  await expect(page.locator('[role="application"][tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('[role="application"] [tabindex="0"]')).toHaveCount(0);
});

test('the teacher board has no engine: no computer suggestion button', async ({ page }) => {
  await expect(page.getByRole('button', { name: /computer/i })).toHaveCount(0);
});

for (const [name, width, height] of [
  ['1366x768', 1366, 768],
  ['820x1180', 820, 1180],
] as const) {
  test(`Present fits ${name}, hides the site chrome and exits with Esc and F`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: 'Present', exact: true }).click();
    const overlay = page.getByRole('region', { name: 'Presenting the analysis board' });
    await expect(overlay).toBeVisible();
    await expect(page.locator('.kl-chrome').first()).toBeHidden();
    const fit = await overlay.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth }));
    expect(fit.scroll).toBeLessThanOrEqual(fit.client);
    expect(fit.sw).toBeLessThanOrEqual(fit.cw);
    const board = await page.locator('[role="application"]').boundingBox();
    if (!board) throw new Error('board not rendered');
    expect(board.y + board.height).toBeLessThanOrEqual(height);
    expect(board.x + board.width).toBeLessThanOrEqual(width);
    expect(board.height).toBeGreaterThan(width > height ? 650 : 450);
    const exit = await page.getByRole('button', { name: 'Exit Present' }).boundingBox();
    if (!exit) throw new Error('exit button not rendered');
    expect(exit.y + exit.height).toBeLessThanOrEqual(height);

    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    await page.getByRole('button', { name: 'Present', exact: true }).click();
    await expect(overlay).toBeVisible();
    await page.getByRole('button', { name: 'Exit Present' }).focus();
    await page.keyboard.press('f');
    await expect(overlay).toHaveCount(0);
  });
}
