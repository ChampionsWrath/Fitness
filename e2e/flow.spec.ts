import { expect, test } from '@playwright/test';

const SHOT = process.env.SHOT_DIR;
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (SHOT) await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: false });
};

test('primary flow: onboarding → workout → sets → finish → history → weight → persists', async ({ page }) => {
  // Monday 7 Sep 2026, 09:00 local
  await page.clock.setFixedTime(new Date(2026, 8, 7, 9, 0, 0));
  await page.goto('/');

  // ---- Onboarding
  await expect(page.getByText('You don’t need to be fit to start.')).toBeVisible();
  await shot(page, '01-onboarding-welcome');
  await page.getByRole('button', { name: 'I understand, let’s go' }).click();
  await page.locator('#ob-weight').fill('220');
  await page.locator('#ob-goal').fill('180');
  await shot(page, '02-onboarding-body');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('What do you have at home?')).toBeVisible();
  await page.getByRole('button', { name: 'Flat bench' }).click();
  await shot(page, '03-onboarding-equipment');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start the program' }).click();

  // ---- Home
  await expect(page.getByText('Week 1', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upper Body + Treadmill' })).toBeVisible();
  await shot(page, '04-home');
  await page.getByRole('button', { name: "START TODAY'S WORKOUT" }).click();

  // ---- Active workout
  await expect(page.getByText('Exercise 1')).toBeVisible();
  await expect(page.getByText('Dumbbell Bench Press', { exact: true }).first()).toBeVisible();
  // lat pulldown must have been swapped for a dumbbell alternative
  await expect(page.getByText('replaces Lat Pulldown')).toBeVisible();
  await expect(page.getByText('Dumbbell Row', { exact: true })).toBeVisible();
  await shot(page, '05-active-workout');

  // open exercise detail and start it
  await page.getByRole('button', { name: 'How to do Dumbbell Bench Press' }).click();
  await expect(page.getByText('Starting position')).toBeVisible();
  await expect(page.getByText('Common mistakes')).toBeVisible();
  await shot(page, '06-exercise-detail-sheet');
  await page.getByRole('button', { name: 'START EXERCISE' }).click();
  await expect(page.getByText('Starting position')).toBeHidden();

  // fill and complete 4 sets of bench press at 35 lb
  for (let i = 1; i <= 4; i++) {
    await page.getByLabel(`Set ${i} weight`).first().fill('35');
    await page.getByLabel(`Set ${i} reps`).first().fill('12');
    await page.getByRole('button', { name: `Complete set ${i}` }).first().click();
    if (i === 1) {
      await expect(page.getByText('Rest 90 sec')).toBeVisible();
      await shot(page, '07-rest-timer');
    }
    if (i < 4) await page.getByRole('button', { name: 'Skip rest' }).click();
  }
  await expect(page.getByLabel('Set 4 complete. Tap to undo').first()).toBeVisible();

  // guided treadmill block
  await page.getByRole('button', { name: 'Start guided timer' }).click();
  await expect(page.getByText('Interval 1 of')).toBeVisible();
  await shot(page, '08-interval-guide-ready');
  await page.getByRole('button', { name: 'START' }).click();
  await expect(page.getByText('Warm-up walk')).toBeVisible();
  await shot(page, '09-interval-guide-running');
  await page.getByRole('button', { name: 'Back to workout' }).click();

  // treadmill readout: 0.6 mi at 2% incline over 10 min (also marks the block complete)
  await page.locator('#cardio-distance-4').fill('0.6');
  await page.locator('#cardio-incline-4').fill('2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await expect(page.locator('.ex-card').nth(4)).toContainText(/≈ \d+ kcal/);
  await expect(page.locator('.ex-card').nth(0)).toContainText(/≈ \d+ kcal/); // lifting credit for the bench sets
  // finish
  await page.getByRole('button', { name: 'FINISH WORKOUT' }).click();
  await expect(page.getByRole('heading', { name: 'Finish workout' })).toBeVisible();
  await expect(page.getByText('Treadmill block has no distance entered')).toBeHidden();
  await expect(page.locator('.burn-summary')).toContainText('Lifting');
  await shot(page, '10-finish-sheet');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByText(/≈ \d+ kcal burned: lifting \d+ · treadmill\/circuit \d+/)).toBeVisible();
  await shot(page, '11b-session-detail-burn');
  await expect(page.getByRole('heading', { name: 'Upper Body + Treadmill' })).toBeVisible();
  await expect(page.getByText('35 × 12  ·  35 × 12  ·  35 × 12  ·  35 × 12')).toBeVisible();
  await shot(page, '11-session-detail');

  // ---- History list
  await page.goto('/#/progress/history');
  await expect(page.getByText('Upper Body + Treadmill')).toBeVisible();
  await expect(page.getByText('4 sets', { exact: false })).toBeVisible();
  await shot(page, '12-history');

  // ---- Weight logging
  await page.goto('/#/progress/weight');
  await page.locator('#wt-weight').fill('219.4');
  await page.locator('#wt-waist').fill('40');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('Saved for', { exact: false })).toBeVisible();
  await expect(page.locator('svg.chart')).toHaveCount(2);
  await shot(page, '13-weight-tracker');

  // ---- Progress tab
  await page.goto('/#/progress');
  await expect(page.locator('svg.chart').first()).toBeVisible();
  await expect(page.getByText('Dumbbell Bench Press')).toBeVisible(); // PR row
  await shot(page, '14-progress');

  // ---- Persistence after reload
  await page.reload();
  await page.goto('/#/home');
  await expect(page.locator('.stat .value', { hasText: '219.4' }).first()).toBeVisible();
  await expect(page.getByText('Completed today')).toBeVisible();
  await expect(page.locator('.stat', { hasText: 'Streak' }).locator('.value')).toHaveText(/^1/);
  await shot(page, '15-home-after');

  // ---- Next session carries weights forward and recommends an increase
  await page.clock.setFixedTime(new Date(2026, 8, 11, 9, 0, 0)); // Friday full body includes bench press
  await page.goto('/#/workout');
  await expect(page.getByRole('heading', { name: 'Full Body' })).toBeVisible();
  await shot(page, '16-workout-tab');
  await page.getByRole('button', { name: 'START WORKOUT' }).click();
  await expect(page.getByText('Consider increasing from 35 lb → 40 lb')).toBeVisible();
  await expect(page.getByLabel('Set 1 weight').nth(1)).toHaveValue('35');
  await shot(page, '17-progressive-overload');

  // ---- Library
  await page.goto('/#/exercises');
  await page.getByLabel('Search exercises').fill('goblet');
  await expect(page.getByText('Goblet Squat')).toBeVisible();
  await shot(page, '18-library');
  await page.getByText('Goblet Squat').click();
  await expect(page.getByText('Hold one dumbbell vertically against your chest')).toBeVisible();
  await shot(page, '19-exercise-page');

  // ---- Food tracker: set targets, log a food, verify totals persist
  await page.goto('/#/food');
  await expect(page.getByText('Set your targets')).toBeVisible();
  await page.locator('#nt-age').fill('32');
  await page.locator('#nt-height').fill('70');
  await page.getByRole('button', { name: 'Set my targets' }).click();
  await expect(page.getByText(/of 1,\d{3} kcal/).first()).toBeVisible();
  await shot(page, '22-food-empty');
  await page.locator('.meal', { hasText: 'Breakfast' }).getByRole('button', { name: 'Add food' }).click();
  await page.getByLabel('Search foods').fill('banana');
  await page.getByRole('button', { name: /^Banana/ }).click();
  await expect(page.getByRole('button', { name: 'Add 105 kcal' })).toBeVisible();
  await shot(page, '23-food-quantity');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Add 158 kcal' }).click();
  await expect(page.locator('.meal', { hasText: 'Breakfast' }).getByText('158 kcal', { exact: false })).toBeVisible();
  await page.locator('.meal', { hasText: 'Lunch' }).getByRole('button', { name: 'Add food' }).click();
  await page.getByLabel('Search foods').fill('chicken breast');
  await page.getByRole('button', { name: /^Chicken breast, cooked/ }).click();
  await page.getByRole('button', { name: /^Add \d+ kcal/ }).click();
  await expect(page.locator('.kcal-hero .big')).toContainText('439');
  // Monday's workout is netted in this week's summary
  await expect(page.getByText(/burned [1-9]\d*\)/)).toBeVisible();
  await shot(page, '24-food-logged');
  await page.getByRole('button', { name: 'Enter steps' }).click();
  await page.locator('#steps-input').fill('12000');
  await expect(page.getByText(/Counts \d+ kcal burned/)).toBeVisible();
  await page.getByRole('button', { name: 'Save steps' }).click();
  await expect(page.getByRole('button', { name: 'Enter steps' })).toContainText('12,000');
  await expect(page.getByRole('button', { name: 'Enter steps' })).toContainText(/\+\d+ kcal/);
  await shot(page, '25-food-steps');
  // steps are netted against today's intake
  const netText = (await page.locator('.kcal-hero .big').textContent()) ?? '';
  const netValue = Number(netText.replace(/of.*$/, '').replace(/[^0-9-]/g, ''));
  expect(netValue).toBeLessThan(439);
  await expect(page.locator('.burn-line')).toContainText('steps');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enter steps' })).toContainText('12,000');
  await expect(page.locator('.burn-line')).toContainText('steps');
  await page.goto('/#/home');
  await expect(page.getByText('net of', { exact: false })).toBeVisible();
  await expect(page.getByText('Ate 439', { exact: false })).toBeVisible();

  await page.goto('/#/settings');
  await shot(page, '20-settings');
  await page.goto('/#/progress/photos');
  await shot(page, '21-photos');
});
