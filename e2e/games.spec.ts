import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { expect, test, type Page } from '@playwright/test';
import { CASTLE_QUESTS, DETECTIVE_CASES, KNIGHT_LEVELS, shortestKnightTrail } from '../src/lib/games';
import type { Puzzle } from '../src/lib/puzzle-types';
import { start, tryMove } from '../src/lib/puzzles';

const pageErrors = new WeakMap<Page, string[]>();
const feedback = (page: Page) => page.locator('.kl-games-page p[role="status"]');
const complete = (page: Page) => page.getByRole('heading', { name: 'Challenge complete!', exact: true });
const clueBoard = (page: Page) => page.getByRole('group', { name: 'Chess Detective clue board', exact: true });
const trailBoard = (page: Page) => page.getByRole('group', { name: 'Knight treasure board', exact: true });
const trailSquare = (page: Page, square: string) => trailBoard(page).getByRole('button', { name: new RegExp(`^${square}:`) });

async function boardMove(page: Page, from: string, to: string): Promise<void> {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}

async function enterTrail(page: Page, number = 1): Promise<void> {
  await page.getByRole('button', { name: `Play Trail ${number}`, exact: true }).click();
  await expect(trailBoard(page)).toBeVisible();
}

async function solveTrail(page: Page, index = 0): Promise<void> {
  const level = KNIGHT_LEVELS[index];
  if (!level) throw new Error('missing trail');
  const path = shortestKnightTrail(level.start, level.treasures, level.exit);
  for (const square of path.slice(1)) await trailSquare(page, square).click();
  await expect(complete(page)).toBeVisible();
}

async function addStudent(page: Page, name: string): Promise<void> {
  await page.goto('#/students');
  await page.getByRole('button', { name: 'Add a student', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function switchStudent(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /^Student: / }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Student: ${name},`) })).toBeVisible();
}

function questPuzzles(theme: string): Puzzle[] {
  const puzzles = JSON.parse(readFileSync(`public/data/puzzles/beginner/${theme}.json`, 'utf8')) as Puzzle[];
  return puzzles.sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id)).slice(0, 5);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

for (const [width, height] of [[1366, 768], [390, 844]] as const) {
  test(`opening a lower Games card resets route scroll at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('#/games');
    await page.locator('.kl-adventure-detective').getByRole('link').click();
    const heading = page.getByRole('heading', { level: 1, name: 'Chess Detective', exact: true });
    await expect(heading).toBeVisible();
    const geometry = await heading.evaluate((element) => ({
      top: element.getBoundingClientRect().top,
      headerBottom: document.querySelector('header')?.getBoundingClientRect().bottom ?? 0,
      gameScroll: document.querySelector('.kl-games-page')?.scrollTop,
      documentScroll: document.scrollingElement?.scrollTop,
    }));
    expect(geometry.top).toBeGreaterThanOrEqual(width >= 1024 ? geometry.headerBottom : 0);
    expect(geometry.gameScroll).toBe(0);
    expect(geometry.documentScroll).toBe(0);
  });
}

test('Games navigation and Home lead to the three adventures and deep links reload', async ({ page }) => {
  await page.goto('#/');
  await page.getByRole('link', { name: 'Play a chess adventure', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your adventure', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Games', exact: true })).toBeVisible();
  for (const title of ['Castle Quest', 'Knight Treasure Trail', 'Chess Detective']) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  for (const [id, title] of [['castle', 'Castle Quest'], ['knight', 'Knight Treasure Trail'], ['detective', 'Chess Detective']] as const) {
    await page.goto(`#/games/${id}`);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'All games', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Choose your adventure', exact: true })).toBeVisible();
  }
  await page.goto('#/games/unknown');
  await expect(page.getByRole('heading', { name: 'Page not found.', exact: true })).toBeVisible();
});

test('every knight trail collects all gems, exits at par, and saves three stars', async ({ page }) => {
  await page.goto('#/games/knight');
  await enterTrail(page);
  for (let index = 0; index < KNIGHT_LEVELS.length; index += 1) {
    await solveTrail(page, index);
    await expect(feedback(page)).toContainText(['Every gem is yours. You reached the flag!', 'You earned 3 stars.']);
    if (index < KNIGHT_LEVELS.length - 1) await page.getByRole('button', { name: 'Next challenge', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Choose a challenge', exact: true }).click();
  await expect(page.getByRole('img', { name: '3 of 3 stars', exact: true })).toHaveCount(KNIGHT_LEVELS.length);
  await page.reload();
  await expect(page.getByRole('img', { name: '3 of 3 stars', exact: true })).toHaveCount(KNIGHT_LEVELS.length);
});

test('knight wrong hops, hints, undo, restart and keyboard moves remain playable', async ({ page }) => {
  await page.goto('#/games/knight');
  await enterTrail(page);
  await expect(page.getByRole('button', { name: 'Undo move', exact: true })).toBeDisabled();
  await trailSquare(page, 'b2').click();
  await expect(feedback(page)).toContainText('L-shaped hop');
  await expect(page.getByText('0 moves', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show a hint', exact: true }).click();
  await expect(feedback(page)).toContainText('c3');
  await trailSquare(page, 'c3').click();
  await expect(page.getByText('1 of 1 gems collected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo move', exact: true }).click();
  await expect(page.getByText('0 of 1 gems collected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(trailSquare(page, 'b1')).toHaveAttribute('aria-label', /White knight/);
  await trailSquare(page, 'b1').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(trailSquare(page, 'c3')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(trailSquare(page, 'e4')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(complete(page)).toBeVisible();
  await expect(feedback(page).last()).toContainText('You earned 3 stars.');
  await expect(trailBoard(page).locator('button[tabindex="0"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await page.getByRole('button', { name: 'Show a hint', exact: true }).click();
  await solveTrail(page);
  await expect(feedback(page).last()).toContainText('You earned 2 stars.');
  await page.getByRole('button', { name: 'Choose a challenge', exact: true }).click();
  const first = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Trail 1', exact: true }) });
  await expect(first.getByRole('img', { name: '3 of 3 stars', exact: true })).toBeVisible();
});

test('every detective case finds the clue and proves its legal capture', async ({ page }) => {
  await page.goto('#/games/detective');
  await page.getByRole('button', { name: 'Play Case 1', exact: true }).click();
  for (let index = 0; index < DETECTIVE_CASES.length; index += 1) {
    const item = DETECTIVE_CASES[index];
    if (!item) throw new Error('missing detective case');
    await clueBoard(page).getByRole('button', { name: new RegExp(`^${item.target}:`) }).click();
    await expect(page.getByRole('application')).toBeFocused();
    await boardMove(page, item.from, item.to);
    await expect(complete(page)).toBeVisible();
    await expect(feedback(page).last()).toContainText('You earned 3 stars.');
    await expect(page.getByText(`You captured the piece on ${item.target}. It had no defender, and your capturing piece cannot be taken immediately.`, { exact: true })).toBeVisible();
    if (index < DETECTIVE_CASES.length - 1) await page.getByRole('button', { name: 'Open the next case', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Choose a challenge', exact: true }).click();
  await expect(page.getByRole('img', { name: '3 of 3 stars', exact: true })).toHaveCount(DETECTIVE_CASES.length);
});

test('detective hints and wrong attempts lead to an assisted completion and a fresh replay', async ({ page }) => {
  const item = DETECTIVE_CASES[0];
  if (!item) throw new Error('missing detective case');
  await page.goto('#/games/detective');
  await page.getByRole('button', { name: 'Play Case 1', exact: true }).click();
  await clueBoard(page).getByRole('button', { name: /^a1:/ }).click();
  await expect(feedback(page)).toContainText('That is not our clue');
  await page.getByRole('button', { name: 'Show a hint', exact: true }).click();
  await expect(feedback(page)).toContainText(`Investigate the piece on ${item.target}`);
  await clueBoard(page).getByRole('button', { name: new RegExp(`^${item.target}:`) }).click();
  const incorrect = new Chess(item.fen).moves({ verbose: true }).find((move) => move.to !== item.target);
  if (!incorrect) throw new Error('missing wrong legal move');
  await boardMove(page, incorrect.from, incorrect.to);
  await expect(feedback(page)).toContainText('Use your clue');
  await page.getByRole('button', { name: 'Show a hint', exact: true }).click();
  await expect(feedback(page)).toContainText(`Move from ${item.from} to ${item.to}`);
  await boardMove(page, item.from, item.to);
  await expect(complete(page)).toBeVisible();
  await expect(feedback(page).last()).toContainText('You earned 1 stars.');
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(clueBoard(page)).toBeVisible();
  await expect(complete(page)).toHaveCount(0);
});

for (const [questIndex, title] of [[0, 'The unguarded gate'], [1, 'The king’s tower'], [2, 'The forked passage']] as const) {
  test(`Castle Quest completes all five rooms of ${title}`, async ({ page }) => {
    const quest = CASTLE_QUESTS[questIndex];
    if (!quest) throw new Error('missing castle quest');
    await page.goto('#/games/castle');
    await page.getByRole('button', { name: `Start adventure ${title}`, exact: true }).click();
    const puzzles = questPuzzles(quest.theme);
    for (let room = 0; room < puzzles.length; room += 1) {
      const puzzle = puzzles[room];
      if (!puzzle) throw new Error('missing castle room');
      await expect(page.getByText(`Room ${room + 1} of 5`, { exact: true })).toBeVisible();
      let state = start(puzzle);
      for (let moveIndex = 1; moveIndex < puzzle.moves.length; moveIndex += 2) {
        const uci = puzzle.moves[moveIndex];
        if (!uci) throw new Error('missing source solution');
        await boardMove(page, uci.slice(0, 2), uci.slice(2, 4));
        const next = tryMove(state, uci);
        if (next.kind === 'wrong') throw new Error('source solution rejected');
        state = next.state;
        if (next.kind === 'continue') await expect(feedback(page)).toContainText('Your opponent replied');
        else break;
      }
      await expect(page.getByText('You found the key!', { exact: true })).toBeVisible();
      await expect(page.getByText(`Door ${room + 1}: unlocked`, { exact: true })).toBeAttached();
      await page.getByRole('button', { name: room === 4 ? 'Open the treasure chest' : 'Open the next door', exact: true }).click();
    }
    await expect(complete(page)).toBeVisible();
    await expect(feedback(page)).toContainText('You earned 3 stars.');
    await page.getByRole('button', { name: 'Play again', exact: true }).click();
    await expect(page.getByText('Room 1 of 5', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Choose a challenge', exact: true }).click();
    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await expect(card.getByRole('img', { name: '3 of 3 stars', exact: true })).toBeVisible();
  });
}

test('Castle Quest wrong moves preserve the position and its hint unlocks the same room', async ({ page }) => {
  const puzzle = questPuzzles('mateIn1')[0];
  if (!puzzle) throw new Error('missing castle puzzle');
  const state = start(puzzle);
  const wrong = new Chess(state.fen).moves({ verbose: true }).find((move) => tryMove(state, move.from + move.to + (move.promotion ?? '')).kind === 'wrong');
  if (!wrong) throw new Error('missing wrong legal move');
  await page.goto('#/games/castle');
  await page.getByRole('button', { name: 'Start adventure The king’s tower', exact: true }).click();
  const board = page.getByRole('application');
  const before = await board.getAttribute('aria-label');
  await boardMove(page, wrong.from, wrong.to);
  await expect(feedback(page)).toContainText('Look for another idea');
  await expect(board).toHaveAttribute('aria-label', before ?? '');
  await page.getByRole('button', { name: 'Show a hint', exact: true }).click();
  const solution = puzzle.moves[1];
  if (!solution) throw new Error('missing solution');
  await expect(page.getByText(`Try moving from ${solution.slice(0, 2)} to ${solution.slice(2, 4)}.`, { exact: true })).toBeVisible();
  await boardMove(page, solution.slice(0, 2), solution.slice(2, 4));
  await expect(page.getByRole('button', { name: 'Open the next door', exact: true })).toBeVisible();
});

test('Castle Quest recovers from a failed puzzle fetch by retrying without a reload', async ({ page }) => {
  const pattern = '**/data/puzzles/beginner/mateIn1.json';
  await page.route(pattern, (route) => route.abort('failed'));
  await page.goto('#/games/castle');
  await page.getByRole('button', { name: 'Start adventure The king’s tower', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The castle could not load');
  await page.unroute(pattern);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Room 1 of 5', { exact: true })).toBeVisible();
  await expect(page.getByRole('application')).toBeVisible();
});

test('switching students resets an unfinished run and isolates saved stars', async ({ page }) => {
  await addStudent(page, 'Maya');
  await page.goto('#/games/knight');
  await enterTrail(page);
  await trailSquare(page, 'c3').click();
  await switchStudent(page, 'Player 1');
  await expect(page.getByRole('button', { name: 'Play Trail 1', exact: true })).toBeVisible();
  await enterTrail(page);
  await expect(page.getByText('0 moves', { exact: true })).toBeVisible();
  await solveTrail(page);
  await switchStudent(page, 'Maya');
  await expect(page.getByRole('img', { name: '0 of 3 stars', exact: true })).toHaveCount(KNIGHT_LEVELS.length);
  await switchStudent(page, 'Player 1');
  const first = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Trail 1', exact: true }) });
  await expect(first.getByRole('img', { name: '3 of 3 stars', exact: true })).toBeVisible();
});

test('failed saving is visible and stars can be saved again when storage recovers', async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Object.defineProperty(window, '__denyGameWrites', { value: true, writable: true });
    Storage.prototype.setItem = function (key: string, value: string): void {
      if ((window as unknown as Record<string, unknown>).__denyGameWrites && key.startsWith('knightlight:v1:profile:')) throw new DOMException('Full test storage', 'QuotaExceededError');
      setItem.call(this, key, value);
    };
  });
  await page.goto('#/games/knight');
  await enterTrail(page);
  await solveTrail(page);
  await expect(feedback(page).last()).toContainText('stars could not be saved');
  await page.evaluate(() => { (window as unknown as Record<string, unknown>).__denyGameWrites = false; });
  await page.getByRole('button', { name: 'Save stars again', exact: true }).click();
  await expect(feedback(page).last()).toContainText('You earned 3 stars.');
  await expect(page.getByRole('button', { name: 'Save stars again', exact: true })).toHaveCount(0);
});

test('the existing export, reset and import UI preserves game stars', async ({ page }) => {
  await page.goto('#/games/knight');
  await enterTrail(page);
  await solveTrail(page);
  await page.goto('#/students');
  await page.getByText('Back up and restore', { exact: true }).first().click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all data', exact: true }).click();
  const downloaded = await downloading;
  const path = await downloaded.path();
  if (!path) throw new Error('backup download unavailable');
  const backup = readFileSync(path, 'utf8');
  expect(backup).toContain('"trail-1"');
  await page.getByRole('button', { name: 'Reset progress for Player 1', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: "Yes, reset Player 1's progress", exact: true }).click();
  await page.goto('#/games/knight');
  await expect(page.getByRole('img', { name: '0 of 3 stars', exact: true })).toHaveCount(KNIGHT_LEVELS.length);
  await page.goto('#/students');
  await page.getByText('Back up and restore', { exact: true }).first().click();
  await page.getByLabel('Backup file (.json)', { exact: true }).setInputFiles({ name: 'knightlight-games.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('dialog').getByRole('button', { name: 'Replace everything', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goto('#/games/knight');
  const first = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Trail 1', exact: true }) });
  await expect(first.getByRole('img', { name: '3 of 3 stars', exact: true })).toBeVisible();
});

for (const [width, height] of [[390, 844], [1024, 768], [820, 1180]] as const) {
  test(`games and active controls fit ${width}x${height} in dark mode with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    for (const game of ['castle', 'knight', 'detective']) {
      await page.goto(`#/games/${game}`);
      if (game === 'castle') await page.getByRole('button', { name: 'Start adventure The king’s tower', exact: true }).click();
      else await page.getByRole('button', { name: `Play ${game === 'knight' ? 'Trail' : 'Case'} 1`, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const hint = page.getByRole('button', { name: 'Show a hint', exact: true });
      await hint.scrollIntoViewIfNeeded();
      await expect(hint).toBeInViewport();
      await hint.click();
      if (game === 'castle') await expect(page.getByText('Try moving from d3 to d8.', { exact: true })).toBeVisible();
      else await expect(feedback(page)).not.toBeEmpty();
      const back = page.getByRole('link', { name: 'All games', exact: true });
      await back.scrollIntoViewIfNeeded();
      await expect(back).toBeInViewport();
      if (game !== 'castle') {
        const size = await page.getByRole('group', { name: game === 'knight' ? 'Knight treasure board' : 'Chess Detective clue board', exact: true }).boundingBox();
        expect(size?.width).toBeGreaterThanOrEqual(width === 390 ? 280 : 400);
      }
    }
  });
}

test('treasure exit flags contrast with every selectable board palette in light and dark', async ({ page }) => {
  const failures: { mode: string; palette: string; trail: number; ratio: number; foreground: string; background: string }[] = [];
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode });
    await page.goto('#/games/knight');
    for (const palette of ['Parchment', 'Projector', 'Sunset', 'Slate']) {
      for (const trail of [2, 4, 6]) {
        await enterTrail(page, trail);
        const contrast = await page.locator('.kl-game-flag').evaluate((flag) => {
          const foreground = getComputedStyle(flag).color;
          const background = getComputedStyle(flag.parentElement ?? flag).backgroundColor;
          const luminance = (color: string): number => {
            const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
            if (!channels || channels.length !== 3) throw new Error(`unsupported computed color: ${color}`);
            return channels.reduce((sum, value, index) => {
              const channel = value / 255;
              const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
              return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0);
            }, 0);
          };
          const light = luminance(foreground);
          const dark = luminance(background);
          return { ratio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05), foreground, background };
        });
        if (contrast.ratio < 3) failures.push({ mode, palette, trail, ...contrast });
        await page.getByRole('button', { name: 'Choose a challenge', exact: true }).click();
      }
      await page.getByRole('button', { name: /^Change board colours/ }).click();
    }
  }
  expect(failures, 'Every exit flag must reach a 3:1 non-text contrast ratio against its actual square.').toEqual([]);
});

for (const [width, height] of [[1024, 768], [1366, 768]] as const) {
  test(`desktop Games launchers and active boards fit without scrolling at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const failures: { screen: string; label: string; top: number; bottom: number; clipTop: number; clipBottom: number }[] = [];
    const inspectFit = async (screen: string, selectors: string[]): Promise<void> => {
      const clipped = await page.locator('.kl-games-page').evaluate((root, requested) => {
        const bounds = root.getBoundingClientRect();
        const clipTop = Math.max(0, bounds.top);
        const clipBottom = Math.min(innerHeight, bounds.bottom);
        return requested.flatMap((selector) => [...root.querySelectorAll<HTMLElement>(selector)].flatMap((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.top >= clipTop - 1 && rect.bottom <= clipBottom + 1) return [];
          return [{ label: element.matches('.kl-game-board') ? 'board rim' : element.getAttribute('aria-label') ?? element.textContent?.trim() ?? selector, top: rect.top, bottom: rect.bottom, clipTop, clipBottom }];
        }));
      }, selectors);
      failures.push(...clipped.map((item) => ({ screen, ...item })));
      const scroll = await page.locator('.kl-games-page').evaluate((element) => ({ client: element.clientHeight, total: element.scrollHeight }));
      if (scroll.total > scroll.client + 1) failures.push({ screen, label: 'Games vertical scroll', top: 0, bottom: scroll.total, clipTop: 0, clipBottom: scroll.client });
    };
    await page.goto('#/games');
    await expect(page.getByRole('heading', { name: 'Choose your adventure', exact: true })).toBeVisible();
    await expect(page.locator('.kl-adventure-card a')).toHaveCount(3);
    await inspectFit('hub', ['.kl-adventure-card a']);
    for (const [game, startName] of [
      ['castle', 'Start adventure The king’s tower'], ['knight', 'Play Trail 1'], ['detective', 'Play Case 1'],
    ] as const) {
      await page.goto(`#/games/${game}`);
      await expect(page.getByRole('button', { name: startName, exact: true })).toBeVisible();
      await expect(page.locator('.kl-games-page section button')).toHaveCount(game === 'castle' ? CASTLE_QUESTS.length : 9);
      await inspectFit(`${game} selector`, ['section button']);
      await page.getByRole('button', { name: startName, exact: true }).click();
      await expect(page.getByRole('button', { name: 'Show a hint', exact: true })).toBeVisible();
      await inspectFit(`${game} active`, ['.kl-game-board', '.kl-game-layout > div:last-child button']);
      if (game === 'castle') {
        await boardMove(page, 'd3', 'd8');
        await expect(page.getByRole('button', { name: 'Open the next door', exact: true })).toBeVisible();
        await inspectFit('castle solved room', ['.kl-game-board', '.kl-game-layout > div:last-child button']);
      }
    }
    expect(failures, 'All desktop launch actions, board rims and active controls must fit the Games viewport without scrolling.').toEqual([]);
  });
}

test('the Games navigation fits 1280 pixels with a full-length student name and usable targets', async ({ page }) => {
  const name = 'Alexandria Christopher Johnson';
  expect(name).toHaveLength(30);
  await page.setViewportSize({ width: 1280, height: 768 });
  await addStudent(page, name);
  await page.goto('#/games');
  await expect(page.getByRole('heading', { name: 'Choose your adventure', exact: true })).toBeVisible();
  const profile = page.getByRole('button', { name: `Student: ${name}, level 1`, exact: true });
  await expect(profile).toBeVisible();
  const geometry = await page.getByRole('banner').evaluate((header) => {
    const nav = header.querySelector('nav');
    if (!nav) throw new Error('missing main navigation');
    const bounds = nav.getBoundingClientRect();
    const controls = [...nav.querySelectorAll<HTMLElement>('a,button')].flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      return [{ label: element.getAttribute('aria-label') ?? element.textContent?.trim(), left: rect.left, right: rect.right, width: rect.width, height: rect.height }];
    });
    return { headerWidth: header.clientWidth, headerScroll: header.scrollWidth, pageScroll: document.documentElement.scrollWidth, viewport: innerWidth, navLeft: bounds.left, navRight: bounds.right, controls };
  });
  expect(geometry.headerScroll).toBeLessThanOrEqual(geometry.headerWidth + 1);
  expect(geometry.pageScroll).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.navLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.navRight).toBeLessThanOrEqual(geometry.viewport + 1);
  for (const control of geometry.controls) {
    expect(control.left, control.label).toBeGreaterThanOrEqual(0);
    expect(control.right, control.label).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(control.width, control.label).toBeGreaterThanOrEqual(44);
    expect(control.height, control.label).toBeGreaterThanOrEqual(44);
  }
  await profile.click();
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
});
