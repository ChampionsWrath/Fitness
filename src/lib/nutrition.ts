import type { FoodEntry, FoodItem, Macros, MealType, NutritionSettings, NutritionTargets, Serving, Unit, UserProfile } from '../types';
import { addDays, startOfWeek } from './dates';

/** Everyday activity only. Workouts and steps are credited separately on the day they happen. */
export const ACTIVITY: Record<NutritionSettings['activity'], { label: string; hint: string; factor: number }> = {
  desk: { label: 'Mostly sitting', hint: 'Desk job or at home', factor: 1.2 },
  onfeet: { label: 'On my feet', hint: 'Retail, teaching, parenting all day', factor: 1.375 },
  physical: { label: 'Physical job', hint: 'Construction, warehouse, farming', factor: 1.55 },
};

export const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
];

export function defaultMealForNow(d = new Date()): MealType {
  const h = d.getHours();
  if (h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export function toKg(w: number, units: Unit): number {
  return units === 'kg' ? w : w * 0.45359237;
}

/** Mifflin-St Jeor with a conservative deficit, floors, and protein/fat/carb split. */
export function computeTargets(profile: UserProfile, currentWeight: number, n: NutritionSettings): NutritionTargets {
  const kg = toKg(currentWeight, profile.units);
  const cm = profile.heightCm ?? 172;
  const base = 10 * kg + 6.25 * cm - 5 * n.age;
  const bmr = Math.round(n.sex === 'male' ? base + 5 : n.sex === 'female' ? base - 161 : base - 78);
  const tdee = Math.round(bmr * ACTIVITY[n.activity].factor);
  // 1 lb of fat ≈ 3500 kcal → 500 kcal/day per lb/week. 1 kg ≈ 7700 kcal.
  const perUnit = profile.units === 'kg' ? 1100 : 500;
  const losing = profile.goalWeight < currentWeight - 1;
  const gaining = profile.goalWeight > currentWeight + 1;
  let deficit = losing ? Math.round(n.pace * perUnit) : gaining ? -250 : 0;
  const floor = n.sex === 'male' ? 1500 : n.sex === 'female' ? 1200 : 1350;
  let kcal = tdee - deficit;
  let floored = false;
  if (kcal < floor) {
    kcal = floor;
    deficit = tdee - floor;
    floored = true;
  }
  if (n.calorieOverride && n.calorieOverride > 0) {
    kcal = Math.round(n.calorieOverride);
    deficit = tdee - kcal;
  }
  const goalLb = profile.units === 'kg' ? profile.goalWeight * 2.2046 : profile.goalWeight;
  let protein = Math.round(Math.min(220, Math.max(100, goalLb * 0.8)));
  if (n.proteinOverride && n.proteinOverride > 0) protein = Math.round(n.proteinOverride);
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr, tdee, kcal: Math.round(kcal), protein, carbs, fat, deficit, floored };
}

/** Steps already assumed by each activity level; only steps beyond this earn extra calories. */
export const BASELINE_STEPS: Record<NutritionSettings['activity'], number> = { desk: 4000, onfeet: 7500, physical: 10000 };

/**
 * Extra calories for steps above the baseline. Walking costs roughly
 * 0.5 kcal per kg per km (net of resting), at about 1,300 steps per km.
 */
export function stepCalories(steps: number, weightKg: number, activity: NutritionSettings['activity']): number {
  const extra = Math.max(0, steps - BASELINE_STEPS[activity]);
  return Math.round((extra / 1300) * 0.5 * weightKg);
}

export const EMPTY: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function macrosFor(food: FoodItem, grams: number): Macros {
  const f = grams / 100;
  const p = food.per100g;
  return {
    kcal: Math.round(p.kcal * f),
    protein: Math.round(p.protein * f * 10) / 10,
    carbs: Math.round(p.carbs * f * 10) / 10,
    fat: Math.round(p.fat * f * 10) / 10,
    fiber: p.fiber != null ? Math.round(p.fiber * f * 10) / 10 : undefined,
  };
}

export function sumEntries(entries: FoodEntry[]): Macros {
  const t = { ...EMPTY };
  for (const e of entries) {
    t.kcal += e.kcal;
    t.protein += e.protein;
    t.carbs += e.carbs;
    t.fat += e.fat;
    t.fiber = (t.fiber ?? 0) + (e.fiber ?? 0);
  }
  return { ...t, protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat), fiber: r1(t.fiber ?? 0) };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface WeekSummary {
  start: string;
  days: { date: string; eaten: number; burned: number; net: number; protein: number; logged: boolean; target: number }[];
  eaten: number;
  burned: number;
  consumed: number; // net calories for the week
  budget: number; // kcal for the whole week
  budgetToDate: number; // kcal for the days elapsed so far (including today)
  remaining: number;
  avgPerDay: number; // net, over days with entries
  proteinAvg: number;
}

/**
 * Week view. `burned` maps a date to calories credited that day (workouts +
 * steps); they are netted against intake so the target stays fixed.
 */
export function summarizeWeek(entries: FoodEntry[], targets: NutritionTargets, today: string, burned: Record<string, number> = {}): WeekSummary {
  const start = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const day = entries.filter((e) => e.date === date);
    const s = sumEntries(day);
    const b = Math.round(burned[date] ?? 0);
    return { date, eaten: s.kcal, burned: b, net: s.kcal - b, protein: s.protein, logged: day.length > 0 || b > 0, target: targets.kcal };
  });
  const elapsed = days.filter((d) => d.date <= today).length;
  const logged = days.filter((d) => d.logged);
  const eaten = days.reduce((a, d) => a + d.eaten, 0);
  const burnedTotal = days.reduce((a, d) => a + d.burned, 0);
  const consumed = eaten - burnedTotal;
  const budget = targets.kcal * 7;
  return {
    start,
    days,
    eaten,
    burned: burnedTotal,
    consumed,
    budget,
    budgetToDate: targets.kcal * elapsed,
    remaining: budget - consumed,
    avgPerDay: logged.length ? Math.round(consumed / logged.length) : 0,
    proteinAvg: logged.length ? Math.round(logged.reduce((a, d) => a + d.protein, 0) / logged.length) : 0,
  };
}

/** Standard servings offered for every food in addition to its own. */
export function servingOptions(food: FoodItem, units: Unit): Serving[] {
  const extra: Serving[] = units === 'lb' ? [{ label: '1 oz', grams: 28.35 }, { label: '100 g', grams: 100 }] : [{ label: '100 g', grams: 100 }, { label: '1 oz', grams: 28.35 }];
  const seen = new Set(food.servings.map((s) => s.label));
  return [...food.servings, ...extra.filter((s) => !seen.has(s.label))];
}

export function fmtG(n: number): string {
  return `${Math.round(n)}g`;
}
