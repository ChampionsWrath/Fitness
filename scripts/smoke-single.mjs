// Smoke-test a single-file build: wraps the fragment like the Artifact host does,
// fakes the claude.ai `db` capability with an in-memory store, and checks that a
// brand-new browser context restores the profile from the cloud copy.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const frag = readFileSync(process.argv[2], 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui;background:#fafafa}[hidden]{display:none!important}img{max-width:100%}</style></head><body>${frag}</body></html>`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const cloud = new Map(); // "collection/id" -> doc, lives in node across browser contexts

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.exposeFunction('__cloudList', (c) => Object.fromEntries([...cloud].filter(([k]) => k.startsWith(c + '/')).map(([k, v]) => [k.slice(c.length + 1), v])));
  await page.exposeFunction('__cloudSet', (c, id, d) => void cloud.set(`${c}/${id}`, d));
  await page.exposeFunction('__cloudDel', (c, id) => void cloud.delete(`${c}/${id}`));
  await page.addInitScript(() => {
    const db = {
      doc: (path) => ({
        set: (d) => window.__cloudSet(...path.split('/'), d),
        delete: () => window.__cloudDel(...path.split('/')),
      }),
      collection: (c) => ({
        get: async () => {
          const all = await window.__cloudList(c);
          return { docs: Object.entries(all).map(([id, data]) => ({ id, exists: true, data: () => data })) };
        },
      }),
    };
    window.claude = { use: async (name) => (name === 'db' ? db : null) };
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.route('https://host.test/**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  return { ctx, page, errors };
}

// Session 1: onboard, log a set, log a weight
let { ctx, page, errors } = await newPage();
await page.goto('https://host.test/app');
await page.getByRole('button', { name: 'I understand, let’s go' }).click();
await page.locator('#ob-weight').fill('220');
await page.locator('#ob-goal').fill('180');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Start the program' }).click();
await page.waitForSelector('text=Week 1');
await page.goto('https://host.test/app#/progress/weight');
await page.locator('#wt-weight').fill('219.4');
await page.getByRole('button', { name: 'Save entry' }).click();
await page.waitForSelector('text=Saved for');
await page.waitForTimeout(2500); // debounce + push
await ctx.close();
console.log('cloud docs after session 1:', [...cloud.keys()].join(', '));
if (!cloud.has('profile/me') || !cloud.has('weights/all')) throw new Error('profile/weights were not pushed to the cloud store');

// Session 2: brand-new context (empty IndexedDB) must restore without onboarding
({ ctx, page, errors } = await newPage());
await page.goto('https://host.test/app');
await page.waitForSelector('text=Week 1', { timeout: 10000 });
const onboarding = await page.getByText('You don’t need to be fit to start.').isVisible().catch(() => false);
if (onboarding) throw new Error('onboarding shown again: restore failed');
await page.goto('https://host.test/app#/progress/weight');
await page.waitForSelector('text=219.4');
await page.goto('https://host.test/app#/settings');
await page.waitForSelector('text=Cloud backup: on');
await page.screenshot({ path: process.argv[3] });
await ctx.close();
console.log('single-file smoke OK: restored profile + weight in a fresh context; console errors:', errors.length ? errors : 'none');
await browser.close();
