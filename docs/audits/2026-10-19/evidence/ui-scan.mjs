import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const out = '.tmp/audit-2026-10-19/ui';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const catalog = JSON.parse(await readFile('public/data/courses/index.json', 'utf8'));
const entries = Array.isArray(catalog) ? catalog : catalog.courses;
const slug = entries.find(x => x.slug !== 'sample-basics').slug;
const course = JSON.parse(await readFile(`public/data/courses/${slug}.json`, 'utf8'));
const lesson = course.chapterList[0].lessons[0].id;
const routes = ['/', '/courses', `/courses/${slug}`, `/learn/${slug}/${lesson}`, '/puzzles', '/puzzles?level=beginner&theme=mateIn1', '/tactics', '/teacher', '/openings', '/play', '/review', '/students', '/assign', '/unknown-audit-route'];
for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:5174/knightlight/#${route}`, { waitUntil: 'networkidle' });
    await page.locator('main').waitFor();
    const metric = await page.evaluate(() => {
      const visible = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const controls = [...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(visible);
      const offscreen = controls.map(e => ({ text: e.getAttribute('aria-label') ?? e.textContent.trim().slice(0, 80), r: e.getBoundingClientRect().toJSON() })).filter(x => x.r.right > innerWidth + 1 || x.r.left < -1);
      const small = controls.filter(e => { const r=e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(e=>({ text:e.getAttribute('aria-label') ?? e.textContent.trim().slice(0,60), w:e.getBoundingClientRect().width, h:e.getBoundingClientRect().height }));
      const b = document.querySelector('[role="application"]');
      return { title: document.querySelector('h1')?.textContent, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, documentHeight: document.documentElement.scrollHeight, offscreen, small, board: b?.getBoundingClientRect().toJSON(), alert: [...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent) };
    });
    results.push({ viewport, route, ...metric, errors: [...errors] });
    await writeFile(`${out}/results.json`, JSON.stringify(results,null,2));
    if (metric.offscreen.length || route === '/teacher' || route.includes('/learn/')) await page.screenshot({ path: `${out}/${viewport.width}-${route.replace(/[^a-z0-9]/gi, '_')}.png` });
  }
  await context.close();
}
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await context.newPage();
await page.goto('http://127.0.0.1:5174/knightlight/', { waitUntil: 'networkidle' });
const search = page.getByRole('button', { name: /search/i });
await search.click();
const afterClick = await page.locator('body').innerText();
await page.keyboard.press('Control+k');
results.push({ searchClickAndShortcut: { dialogCount: await page.getByRole('dialog').count(), inputs: await page.locator('input').count(), textChangedAfterShortcut: afterClick !== await page.locator('body').innerText() } });
for (const route of ['/puzzles?level=beginner&theme=mateIn1', `/learn/${slug}/${lesson}`, '/teacher']) {
  for (const viewport of [{ width:1366,height:768 }, { width:1024,height:768 }, { width:768,height:1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto('http://127.0.0.1:5174/knightlight/#/unknown-audit-route', { waitUntil:'networkidle' });
    await page.goto(`http://127.0.0.1:5174/knightlight/#${route}`, { waitUntil:'networkidle' });
    const toggle = page.getByRole('button', { name: route.startsWith('/puzzles') ? 'Class Mode' : 'Present', exact: true });
    await toggle.click();
    const metric = await page.locator('.fixed.inset-0').evaluate(e => ({ scrollHeight:e.scrollHeight, clientHeight:e.clientHeight, scrollWidth:e.scrollWidth, clientWidth:e.clientWidth, controls:[...e.querySelectorAll('button,a')].filter(x=>x.getBoundingClientRect().width>0).map(x=>({text:x.textContent.trim(),r:x.getBoundingClientRect().toJSON()})) }));
    results.push({ present:route, viewport, ...metric });
    await writeFile(`${out}/results.json`, JSON.stringify(results,null,2));
    await page.screenshot({path:`${out}/present-${viewport.width}-${route.replace(/[^a-z0-9]/gi, '_')}.png`});
  }
}
await writeFile(`${out}/results.json`, JSON.stringify(results,null,2));
console.log(JSON.stringify({screens:results.length, errors:results.filter(x=>x.errors?.length), overflow:results.filter(x=>x.documentWidth>x.viewportWidth), search:results.find(x=>x.searchClickAndShortcut), present:results.filter(x=>x.present).map(x=>({route:x.present,viewport:x.viewport,scrollHeight:x.scrollHeight,clientHeight:x.clientHeight,scrollWidth:x.scrollWidth,clientWidth:x.clientWidth}))}, null, 2));
await browser.close();
