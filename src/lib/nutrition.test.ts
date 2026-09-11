import { describe, expect, it } from 'vitest';
import { defaultProfile } from '../db/repo';
import { FOODS, FOOD_MAP } from '../data/foods';
import { computeTargets, macrosFor, stepCalories, sumEntries, summarizeWeek } from './nutrition';
import type { FoodEntry } from '../types';

const profile = { ...defaultProfile(), startWeight: 220, goalWeight: 180, heightCm: 178 };
const settings = { sex: 'male' as const, age: 30, activity: 'desk' as const, pace: 1, updatedAt: 0 };

describe('computeTargets', () => {
  it('computes a sensible deficit for a 220 lb man losing 1 lb/week', () => {
    const t = computeTargets(profile, 220, settings);
    expect(t.bmr).toBe(1965); // 10*99.79 + 6.25*178 - 5*30 + 5
    expect(t.tdee).toBe(2358); // × 1.2 (no exercise: workouts and steps are credited per day)
    expect(t.kcal).toBe(1858); // − 500 for 1 lb/week
    expect(t.protein).toBe(144); // 0.8 g/lb of goal weight
    expect(t.fat).toBe(58);
    expect(t.carbs).toBe(190);
    expect(t.floored).toBe(false);
  });
  it('never goes below the calorie floor', () => {
    const t = computeTargets({ ...profile, startWeight: 130, goalWeight: 110, heightCm: 155 }, 130, { ...settings, sex: 'female', pace: 2, age: 50 });
    expect(t.kcal).toBe(1200);
    expect(t.floored).toBe(true);
  });
  it('honours overrides', () => {
    const t = computeTargets(profile, 220, { ...settings, calorieOverride: 2000, proteinOverride: 160 });
    expect(t.kcal).toBe(2000);
    expect(t.protein).toBe(160);
  });
  it('gives maintenance when at goal', () => {
    const t = computeTargets({ ...profile, goalWeight: 220 }, 220, settings);
    expect(t.kcal).toBe(t.tdee);
  });
});

describe('food database', () => {
  it('has unique ids, servings and plausible macros', () => {
    const ids = new Set<string>();
    const alcohol = new Set(['beer', 'beer-light', 'wine', 'spirits']);
    for (const f of FOODS) {
      expect(ids.has(f.id), f.id).toBe(false);
      ids.add(f.id);
      expect(f.servings.length, f.id).toBeGreaterThan(0);
      if (alcohol.has(f.id)) continue;
      const { kcal, protein, carbs, fat } = f.per100g;
      const est = protein * 4 + carbs * 4 + fat * 9;
      // energy should roughly match macros (alcohol and fibre make this loose)
      expect(Math.abs(est - kcal), `${f.id} kcal ${kcal} vs macros ${est}`).toBeLessThanOrEqual(Math.max(45, kcal * 0.35));
    }
    expect(FOODS.length).toBeGreaterThan(150);
  });
  it('scales macros by grams', () => {
    const m = macrosFor(FOOD_MAP['chicken-breast'], 200);
    expect(m.kcal).toBe(330);
    expect(m.protein).toBe(62);
  });
});

describe('stepCalories', () => {
  it('only credits steps above the activity baseline', () => {
    expect(stepCalories(3000, 100, 'desk')).toBe(0);
    expect(stepCalories(14000, 100, 'desk')).toBe(385); // 10k extra steps at 100 kg
    expect(stepCalories(14000, 100, 'physical')).toBe(154);
    expect(stepCalories(9000, 70, 'desk')).toBe(135);
  });
});

describe('week summary', () => {
  it('sums a week and computes remaining budget', () => {
    const e = (date: string, kcal: number): FoodEntry => ({
      id: date + kcal,
      date,
      meal: 'lunch',
      name: 'x',
      quantity: 1,
      servingLabel: '1',
      grams: 100,
      kcal,
      protein: 30,
      carbs: 0,
      fat: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    const t = computeTargets(profile, 220, settings);
    const w = summarizeWeek([e('2026-09-07', 2000), e('2026-09-08', 2400)], t, '2026-09-08');
    expect(w.start).toBe('2026-09-07');
    expect(w.consumed).toBe(4400);
    expect(w.budget).toBe(t.kcal * 7);
    expect(w.budgetToDate).toBe(t.kcal * 2);
    const wb = summarizeWeek([e('2026-09-07', 2000)], t, '2026-09-08', { '2026-09-07': 300 });
    expect(wb.budget).toBe(t.kcal * 7);
    expect(wb.days[0].net).toBe(1700);
    expect(wb.burned).toBe(300);
    expect(wb.remaining).toBe(t.kcal * 7 - 1700);
    expect(w.avgPerDay).toBe(2200);
    expect(sumEntries([e('2026-09-07', 100)]).protein).toBe(30);
  });
});
