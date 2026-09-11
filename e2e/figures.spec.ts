import { test } from '@playwright/test';

const SHOT = process.env.SHOT_DIR;

test('figure gallery at both ends of the loop', async ({ page }) => {
  test.skip(!SHOT, 'screenshots only');
  await page.setViewportSize({ width: 600, height: 2400 });
  await page.goto('/#/figures?t=0.02');
  await page.waitForSelector('[data-key]');
  await page.screenshot({ path: `${SHOT}/figures-a.png`, fullPage: true });
  await page.goto('/#/figures?t=0.52');
  await page.reload();
  await page.waitForSelector('[data-key]');
  await page.screenshot({ path: `${SHOT}/figures-b.png`, fullPage: true });
});
