import { writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const base = 'http://127.0.0.1:4174/knightlight/';
const report = { startedAt: new Date().toISOString(), checks: [] };
const browser = await chromium.launch({ headless: true });
async function check(name, fn) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  try { const detail = await fn(page); report.checks.push({ name, status: detail?.fits === false ? 'FAIL' : 'PASS', detail, pageErrors }); }
  catch(error) { report.checks.push({ name, status: 'FAIL', error: String(error), pageErrors }); }
  finally { await context.close(); }
}
try {
  await check('Production Play White accepts a move and bot replies using current accessible labels', async page => {
    await page.goto(`${base}#/play`);
    const labels = await page.getByRole('radio').allTextContents();
    await page.getByRole('radio', { name: /Opponent 1: Sleepy Pawn/ }).check();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.getByRole('list', { name: 'Moves' }).getByRole('listitem').first()).toContainText(/^1\.e4.+/, { timeout: 15000 });
    return { moves: await page.getByRole('list', { name: 'Moves' }).innerText(), labels };
  });
  await check('Production Play Black lets bot open using current accessible labels', async page => {
    await page.goto(`${base}#/play`);
    await page.getByRole('radio', { name: /Opponent 1: Sleepy Pawn/ }).check();
    await page.locator('label').filter({ has: page.getByRole('radio', { name: 'Black', exact: true }) }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Moves' }).getByRole('listitem').first()).toContainText(/^1\.\S+/, { timeout: 15000 });
    return { moves: await page.getByRole('list', { name: 'Moves' }).innerText() };
  });
  await check('Production student avatar and reset controls work with current roles and names', async page => {
    await page.goto(`${base}#/students`);
    await page.getByRole('button', { name: 'Add a student', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Maya');
    await dialog.getByRole('radio', { name: 'Choose avatar 🐼', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Maya', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reset progress for Maya', exact: true }).click();
    const confirm = dialog.getByRole('button', { name: "Yes, reset Maya's progress", exact: true });
    await confirm.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').first()).toContainText('Progress for Maya was reset.');
    return { status: await page.getByRole('status').first().innerText() };
  });
  await check('Production bad-version import retains profile and explains rejection', async page => {
    await page.goto(`${base}#/students`);
    await page.locator('input[type="file"]').setInputFiles({ name: 'v9.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'knightlight', version: 9 })) });
    const alert = page.getByRole('alert').filter({ hasText: 'Nothing was changed' });
    await expect(alert).toContainText('This backup came from a different version of Knightlight.');
    await expect(page.getByRole('heading', { level: 3, name: 'Player 1', exact: true })).toBeVisible();
    return { alert: await alert.innerText() };
  });
  await check('Production puzzle assignment opens expected set using current copy', async page => {
    await page.goto(`${base}#/assign?type=puzzles&level=beginner&theme=fork`);
    const text = await page.locator('main').innerText();
    await page.getByRole('link', { name: 'Start the puzzles', exact: true }).click();
    await expect(page.getByRole('application')).toBeVisible();
    return { assignmentText: text, url: page.url() };
  });
  await check('Production Teacher Present portrait control geometry', async page => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto(`${base}#/teacher`);
    await page.getByRole('button', { name: 'Present', exact: true }).click();
    const overlay = page.getByRole('region', { name: 'Presenting the analysis board' });
    const geometry = await overlay.evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    const exit = await page.getByRole('button', { name: 'Exit Present', exact: true }).boundingBox();
    await page.screenshot({ path: new URL('./teacher-present-portrait.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:\/)/, '$1') });
    return { ...geometry, exit, viewportHeight:1180, exitBottom: exit ? exit.y + exit.height : null, fits: Boolean(exit && exit.y + exit.height <= 1180 && geometry.scrollHeight <= geometry.clientHeight) };
  });
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  writeFileSync(new URL('./failure-diagnostics.json', import.meta.url), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
