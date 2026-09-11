import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const svg = readFileSync(process.argv[2], 'utf8');
const out = process.argv[3];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:#0f1115">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false });
  writeFileSync(`${out}/${name}`, buf);
  await page.close();
}
await browser.close();
console.log('icons written');
