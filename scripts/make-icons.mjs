// Renders public/favicon.svg to the PNG icons the PWA manifest needs. Run: node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/favicon.svg', 'utf8');
const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

// Maskable icons need a full-bleed background and the artwork inside the central safe zone.
const targets = [
  { file: 'public/icon-192.png', size: 192, inset: 0, bg: 'transparent' },
  { file: 'public/icon-512.png', size: 512, inset: 0, bg: 'transparent' },
  { file: 'public/icon-maskable-512.png', size: 512, inset: 0.12, bg: '#0F3D3E' },
];

const browser = await chromium.launch();
try {
  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
    const pad = Math.round(t.size * t.inset);
    await page.setContent(
      `<body style="margin:0;background:${t.bg};display:grid;place-items:center;width:${t.size}px;height:${t.size}px"><img src="${dataUri}" width="${t.size - pad * 2}" height="${t.size - pad * 2}"></body>`,
    );
    const png = await page.screenshot({ omitBackground: t.bg === 'transparent' });
    writeFileSync(t.file, png);
    await page.close();
  }
} finally {
  await browser.close();
}
