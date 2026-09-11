import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { listWeights } from '../db/repo';
import { computeTargets, stepCalories, toKg } from '../lib/nutrition';
import type { NutritionTargets, UserProfile, WorkoutSession } from '../types';

/** Current weight (latest weigh-in or the onboarding weight) and computed daily targets, or null until setup. */
export function useNutrition(profile: UserProfile): { currentWeight: number; weightKg: number; targets: NutritionTargets | null; bonusFor: (steps: number | undefined) => number } {
  const weights = useLiveQuery(listWeights, []) ?? [];
  const currentWeight = weights.length ? weights[weights.length - 1].weight : profile.startWeight;
  const weightKg = toKg(currentWeight, profile.units);
  const n = profile.nutrition;
  const targets = n ? computeTargets(profile, currentWeight, n) : null;
  const bonusFor = (steps: number | undefined) => (n && n.countSteps !== false && steps ? stepCalories(steps, weightKg, n.activity) : 0);
  return { currentWeight, weightKg, targets, bonusFor };
}

/** Completed workouts between two dates (inclusive), for calorie credit. */
export function useWorkoutsBetween(from: string, to: string): WorkoutSession[] {
  return useLiveQuery(() => db.sessions.where('date').between(from, to, true, true).and((s) => s.status === 'completed').toArray(), [from, to]) ?? [];
}

export function workoutBurn(sessions: WorkoutSession[], date: string): number {
  return sessions.filter((s) => s.date === date).reduce((a, s) => a + (s.caloriesBurned ?? 0), 0);
}

export function workoutBurnSplit(sessions: WorkoutSession[], date: string): { lifting: number; cardio: number } {
  const day = sessions.filter((s) => s.date === date);
  return {
    lifting: day.reduce((a, s) => a + (s.burnLifting ?? 0), 0),
    cardio: day.reduce((a, s) => a + (s.burnCardio ?? (s.burnLifting == null ? s.caloriesBurned ?? 0 : 0)), 0),
  };
}
