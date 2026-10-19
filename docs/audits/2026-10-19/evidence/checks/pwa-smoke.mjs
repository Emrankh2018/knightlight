import { readdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const report = { startedAt: new Date().toISOString(), checks: [], consoleErrors: [] };
const base = 'http://127.0.0.1:4174/knightlight/';
const workerAsset = readdirSync('dist/assets').find(p => /^worker-.*\.js$/.test(p));
let browser;
async function check(name, action) {
  try { const detail = await action(); report.checks.push({ name, status: 'PASS', detail }); }
  catch (error) { report.checks.push({ name, status: 'FAIL', error: String(error) }); }
}
try {
  const end = Date.now() + 30000;
  for (;;) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (Date.now() > end) throw new Error('Preview did not respond');
    await new Promise(r => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', e => report.consoleErrors.push(String(e)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await check('Native production module worker returns a move', async () => page.evaluate(async ({ base, workerAsset }) => {
    const worker = new Worker(`${base}assets/${workerAsset}`, { type: 'module' });
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('native worker response timeout')), 20000);
        worker.onmessage = e => { clearTimeout(timer); if (e.data.error) reject(new Error(JSON.stringify(e.data))); else resolve(e.data); };
        worker.onerror = e => { clearTimeout(timer); reject(new Error(e.message)); };
        worker.postMessage({ id: 1, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', level: 'pawn', history: [] });
      });
    } finally { worker.terminate(); }
  }, { base, workerAsset }));
  await check('Service worker activates on production preview', async () => {
    await page.evaluate(async () => {
      await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker readiness timeout')), 30000))]);
    });
    await page.reload({ waitUntil: 'networkidle' });
    const controller = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
    if (!controller) throw new Error('No controlling service worker after readiness and reload');
    return { controller, cacheNames: await page.evaluate(() => caches.keys()) };
  });
  await page.goto(`${base}#/learn/italian-game/first-moves`);
  await page.getByText(/^Step 1 of 3/).waitFor();
  await context.setOffline(true);
  await check('Every indexed puzzle JSON is available offline after first visit', async () => page.evaluate(async () => {
    const indexResponse = await fetch('data/puzzles/index.json');
    if (!indexResponse.ok) throw new Error(`index ${indexResponse.status}`);
    const index = await indexResponse.json();
    let buckets = 0;
    let rows = 0;
    for (const level of index.levels) for (const bucket of level.buckets) {
      const response = await fetch(`data/puzzles/${bucket.file}`);
      if (!response.ok) throw new Error(`${bucket.file}: ${response.status}`);
      const data = await response.json();
      if (data.length !== bucket.count) throw new Error(`${bucket.file}: expected ${bucket.count}, got ${data.length}`);
      buckets++;
      rows += data.length;
    }
    return { levels: index.levels.length, buckets, rows };
  }));
  await check('Offline reload restores a previously visited lesson', async () => {
    await page.reload();
    await page.getByText(/^Step 1 of 3/).waitFor();
    await page.getByRole('application').waitFor();
    return { url: page.url() };
  });
  await check('Offline puzzle route renders board', async () => {
    await page.goto(`${base}#/puzzles?level=master&theme=mateIn2`);
    await page.getByRole('application').waitFor();
    return { url: page.url() };
  });
  await check('Previously unvisited course offline behavior is recorded', async () => {
    await page.goto(`${base}#/courses/queens-gambit`);
    await page.waitForTimeout(1000);
    return { text: (await page.locator('main').innerText()).slice(0, 1800) };
  });
  await page.screenshot({ path: new URL('./pwa-offline-last-page.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:\/)/, '$1'), fullPage: true });
} catch (error) {
  report.fatalError = String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  writeFileSync(new URL('./pwa-smoke.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
