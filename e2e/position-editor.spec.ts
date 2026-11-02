import { expect, test, type Locator, type Page } from '@playwright/test';

const analysis = (page: Page) => page.getByRole('application');
const setupSquare = (dialog: Locator, square: string) => dialog.locator(`[data-setup-square="${square}"]`);

async function openEditor(page: Page): Promise<Locator> {
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Set up position', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Set up position', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function place(dialog: Locator, piece: string, square: string): Promise<void> {
  await dialog.getByRole('button', { name: piece, exact: true }).click();
  await setupSquare(dialog, square).click();
}

async function emptyKings(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Clear board', exact: true }).click();
  await place(dialog, 'White king', 'e1');
  await place(dialog, 'Black king', 'e8');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('#/teacher');
  await expect(page.getByRole('heading', { name: 'Teacher analysis board', exact: true })).toBeVisible();
});

test('clear, place and apply an arbitrary black-to-move position, then teach and reset from it', async ({ page }) => {
  const dialog = await openEditor(page);
  await dialog.getByRole('button', { name: 'Clear board', exact: true }).click();
  await dialog.getByRole('button', { name: 'Use this position', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('one White king and one Black king');
  await place(dialog, 'White king', 'e1');
  await place(dialog, 'Black king', 'e8');
  await place(dialog, 'White knight', 'd4');
  await dialog.getByRole('button', { name: 'Black', exact: true }).click();
  await dialog.getByRole('button', { name: 'Use this position', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(analysis(page)).toHaveAttribute('aria-label', /Black to move.*King e1, Knight d4.*King e8/);
  await page.locator('[data-square="e8"]').click();
  await page.locator('[data-square="e7"]').click();
  await expect(page.getByRole('button', { name: 'Move 1: Ke7', exact: true })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="an-moves"]')).toContainText('1...');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(analysis(page)).toHaveAttribute('aria-label', /Black to move.*King e8/);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(analysis(page)).toHaveAttribute('aria-label', /White to move.*King e7/);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(analysis(page)).toHaveAttribute('aria-label', /Black to move.*Knight d4.*King e8/);
  await expect(page.getByRole('button', { name: 'Move 1: Ke7', exact: true })).toHaveCount(0);
});

test('Cancel and Escape preserve the analysis, notes and focus while shortcuts stay inside the editor', async ({ page }) => {
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await page.getByLabel('Notes for this session').fill('Ask about the centre');
  const original = await analysis(page).getAttribute('aria-label');
  const dialog = await openEditor(page);
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await dialog.getByRole('button', { name: 'Clear board', exact: true }).click();
  await page.keyboard.press('f');
  await page.keyboard.press('ArrowLeft');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(analysis(page)).toHaveAttribute('aria-label', original ?? '');
  await expect(page.getByLabel('Notes for this session')).toHaveValue('Ask about the centre');
  await expect(page.getByRole('button', { name: 'Set up position', exact: true })).toBeFocused();
  await expect(page.getByRole('region', { name: 'Presenting the analysis board' })).toHaveCount(0);
  await openEditor(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(analysis(page)).toHaveAttribute('aria-label', original ?? '');
});

test('keyboard placement, deletion, erasing and flip work without playing legal moves', async ({ page }) => {
  const dialog = await openEditor(page);
  await dialog.getByRole('button', { name: 'Clear board', exact: true }).click();
  await dialog.getByRole('button', { name: 'White rook', exact: true }).click();
  await setupSquare(dialog, 'd4').focus();
  await page.keyboard.press('Enter');
  await expect(setupSquare(dialog, 'd4')).toHaveAttribute('aria-label', 'd4: White rook');
  await page.keyboard.press('ArrowRight');
  await expect(setupSquare(dialog, 'e4')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(setupSquare(dialog, 'e4')).toHaveAttribute('aria-label', 'e4: White rook');
  await page.keyboard.press('Delete');
  await expect(setupSquare(dialog, 'e4')).toHaveAttribute('aria-label', 'e4: empty');
  await dialog.getByRole('button', { name: 'Remove pieces', exact: true }).click();
  await setupSquare(dialog, 'd4').click();
  await expect(setupSquare(dialog, 'd4')).toHaveAttribute('aria-label', 'd4: empty');
  await dialog.getByRole('button', { name: 'Flip board', exact: true }).click();
  await expect(dialog.locator('[data-setup-square]').first()).toHaveAttribute('data-setup-square', 'h1');
  await expect(dialog.locator('[data-setup-square][tabindex="0"]')).toHaveCount(1);
});

test('dragging existing pieces ignores move rules and dragging into the panel removes them', async ({ page }) => {
  const dialog = await openEditor(page);
  await setupSquare(dialog, 'a2').dragTo(setupSquare(dialog, 'a6'));
  await expect(setupSquare(dialog, 'a2')).toHaveAttribute('aria-label', 'a2: empty');
  await expect(setupSquare(dialog, 'a6')).toHaveAttribute('aria-label', 'a6: White pawn');
  await setupSquare(dialog, 'a6').dragTo(dialog.getByRole('button', { name: 'Remove pieces', exact: true }));
  await expect(setupSquare(dialog, 'a6')).toHaveAttribute('aria-label', 'a6: empty');
});

test('castling settings and clipboard exports describe the applied setup', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const dialog = await openEditor(page);
  await emptyKings(dialog);
  await expect(dialog.getByRole('checkbox', { name: 'White O-O', exact: true })).toBeDisabled();
  await place(dialog, 'White rook', 'h1');
  await dialog.getByRole('checkbox', { name: 'White O-O', exact: true }).check();
  await dialog.getByRole('button', { name: 'Use this position', exact: true }).click();
  await page.getByRole('button', { name: 'Copy FEN', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
  await page.getByRole('button', { name: 'Copy PGN', exact: true }).click();
  const pgn = await page.evaluate(() => navigator.clipboard.readText());
  expect(pgn).toContain('[SetUp "1"]');
  expect(pgn).toContain('[FEN "4k3/8/8/8/8/8/8/4K2R w K - 0 1"]');
  await page.locator('[data-square="e1"]').click();
  await page.locator('[data-square="g1"]').click();
  await expect(page.getByRole('button', { name: 'Move 1: O-O', exact: true })).toBeVisible();
});

for (const [width, height] of [[390, 844], [1024, 768], [820, 1180]] as const) {
  test(`setup controls remain reachable at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const dialog = await openEditor(page);
    const overflow = await dialog.evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth, page: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
    expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
    await emptyKings(dialog);
    await place(dialog, 'White queen', 'd4');
    const apply = dialog.getByRole('button', { name: 'Use this position', exact: true });
    await apply.scrollIntoViewIfNeeded();
    await expect(apply).toBeInViewport();
    await apply.click();
    await expect(dialog).toHaveCount(0);
    await expect(analysis(page)).toHaveAttribute('aria-label', /Queen d4/);
  });
}

test('position setup can open and apply inside Present without leaking its Escape shortcut', async ({ page }) => {
  await page.getByRole('button', { name: 'Present', exact: true }).click();
  const present = page.getByRole('region', { name: 'Presenting the analysis board' });
  const dialog = await openEditor(page);
  await emptyKings(dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(present).toBeVisible();
  const editor = await openEditor(page);
  await emptyKings(editor);
  await place(editor, 'White knight', 'c3');
  await editor.getByRole('button', { name: 'Use this position', exact: true }).click();
  await expect(present).toBeVisible();
  await expect(analysis(page)).toHaveAttribute('aria-label', /Knight c3/);
  await page.getByRole('button', { name: 'Exit Present', exact: true }).click();
  await expect(analysis(page)).toHaveAttribute('aria-label', /Knight c3/);
});

test('phone editor opens at the top with its title and board visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await openEditor(page);
  expect(await dialog.evaluate((el) => el.scrollTop)).toBeLessThanOrEqual(1);
  await expect(dialog.getByRole('heading', { name: 'Set up position', exact: true })).toBeInViewport();
  await expect(setupSquare(dialog, 'a8')).toBeInViewport();
  await expect(setupSquare(dialog, 'h1')).toBeInViewport();
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
});

test('flipped phone editor opens at the top and keeps a visible keyboard entry point', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Flip board', exact: true }).click();
  const dialog = await openEditor(page);
  expect(await dialog.evaluate((el) => el.scrollTop)).toBeLessThanOrEqual(1);
  await expect(dialog.getByRole('heading', { name: 'Set up position', exact: true })).toBeInViewport();
  await expect(setupSquare(dialog, 'h1')).toBeInViewport();
  await expect(setupSquare(dialog, 'a8')).toBeInViewport();
  await expect(dialog.locator('[data-setup-square][tabindex="0"]')).toBeInViewport();
});

test('keyboard square focus contrasts with both square colours in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  const dialog = await openEditor(page);
  await setupSquare(dialog, 'a8').focus();
  for (const [key, square] of [['ArrowRight', 'b8'], ['ArrowLeft', 'a8']] as const) {
    await page.keyboard.press(key);
    const focused = setupSquare(dialog, square);
    await expect(focused).toBeFocused();
    const contrast = await focused.evaluate((el) => {
      const style = getComputedStyle(el);
      const luminance = (color: string): number => {
        const rgb = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((channel) => {
          const n = channel / 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        });
        return (rgb[0] ?? 0) * 0.2126 + (rgb[1] ?? 0) * 0.7152 + (rgb[2] ?? 0) * 0.0722;
      };
      const foreground = luminance(style.outlineColor);
      const background = luminance(style.backgroundColor);
      return { ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05), width: Number.parseFloat(style.outlineWidth), outline: style.outlineStyle };
    });
    expect(contrast.outline).not.toBe('none');
    expect(contrast.width).toBeGreaterThanOrEqual(2);
    expect(contrast.ratio).toBeGreaterThanOrEqual(3);
  }
});

test.describe('touch position setup', () => {
  test.use({ hasTouch: true });

  test('tap placement applies a position on a phone in dark reduced-motion mode', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Set up position', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: 'Set up position', exact: true });
    await dialog.getByRole('button', { name: 'Clear board', exact: true }).tap();
    for (const [piece, square] of [['White king', 'e1'], ['Black king', 'e8'], ['White bishop', 'c4']] as const) {
      await dialog.getByRole('button', { name: piece, exact: true }).tap();
      await setupSquare(dialog, square).tap();
    }
    await dialog.getByRole('button', { name: 'Use this position', exact: true }).tap();
    await expect(dialog).toHaveCount(0);
    await expect(analysis(page)).toHaveAttribute('aria-label', /Bishop c4/);
  });
});
