import type { Exercise, ExerciseSet, SetPrescription, Unit } from '../types';

export interface Recommendation {
  kind: 'increase' | 'hold' | 'push' | 'bodyweight';
  message: string;
  suggestedWeight: number;
}

export function weightIncrement(exercise: Exercise, units: Unit): number {
  const light = exercise.defaultWeightLb <= 15;
  if (units === 'kg') return light ? 1 : 2.5;
  return light ? 2.5 : 5;
}

export function formatWeight(w: number, units: Unit): string {
  return `${Number.isInteger(w) ? w : w.toFixed(1)} ${units}`;
}

/**
 * Look at the most recent completed sets for an exercise and suggest what to
 * do this time. Never changes the weight for the user: only a recommendation.
 */
export function getRecommendation(
  exercise: Exercise,
  prescription: SetPrescription,
  lastSets: ExerciseSet[],
  units: Unit,
): Recommendation | null {
  const done = lastSets.filter((s) => s.completed);
  if (!done.length) return null;
  const weight = Math.max(...done.map((s) => s.weight));
  const allSetsDone = done.length >= prescription.sets;
  const allAtTop = done.every((s) => s.reps >= prescription.repMax);
  const anyBelowMin = done.some((s) => s.reps < prescription.repMin);

  if (weight <= 0) {
    if (allSetsDone && allAtTop) {
      return {
        kind: 'bodyweight',
        message: `You hit ${prescription.repMax} reps on every set last time. Try holding a light dumbbell, or add 2 reps per set.`,
        suggestedWeight: 0,
      };
    }
    return null;
  }

  if (allSetsDone && allAtTop) {
    const next = weight + weightIncrement(exercise, units);
    const minReps = Math.min(...done.map((s) => s.reps));
    return {
      kind: 'increase',
      message: `You hit ${minReps} reps on all ${done.length} sets last time. Consider increasing from ${formatWeight(weight, units)} → ${formatWeight(next, units)}.`,
      suggestedWeight: next,
    };
  }
  if (anyBelowMin) {
    return {
      kind: 'hold',
      message: `Stay at ${formatWeight(weight, units)} and aim for at least ${prescription.repMin} reps on every set.`,
      suggestedWeight: weight,
    };
  }
  return {
    kind: 'push',
    message: `Stay at ${formatWeight(weight, units)}. Reach ${prescription.repMax} reps on all sets, then go up.`,
    suggestedWeight: weight,
  };
}

/** Epley estimated one-rep max. */
export function estimated1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export interface PR {
  exerciseId: string;
  weight: number;
  reps: number;
  date: string;
  e1rm: number;
}

export function computePRs(sets: ExerciseSet[]): Record<string, PR> {
  const best: Record<string, PR> = {};
  for (const s of sets) {
    if (!s.completed || s.weight <= 0) continue;
    const e = estimated1RM(s.weight, s.reps);
    const cur = best[s.exerciseId];
    if (!cur || e > cur.e1rm || (e === cur.e1rm && s.weight > cur.weight)) {
      best[s.exerciseId] = { exerciseId: s.exerciseId, weight: s.weight, reps: s.reps, date: s.date, e1rm: e };
    }
  }
  return best;
}
