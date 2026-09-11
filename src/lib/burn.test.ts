import { describe, expect, it } from 'vitest';
import { getExercise } from '../data/exercises';
import { cardioBurn, liftingBurnForExercise, sessionBurn } from './burn';
import type { ExerciseSet, WorkoutSession } from '../types';

const set = (n: number, completedAt?: number): ExerciseSet => ({
  id: `s${n}`,
  sessionId: 's',
  exerciseId: 'goblet-squat',
  date: '2026-09-07',
  setNumber: n,
  weight: 20,
  reps: 10,
  completed: true,
  completedAt,
  updatedAt: 0,
});

describe('liftingBurnForExercise', () => {
  it('uses the real gap between sets and the exercise MET', () => {
    const ex = getExercise('goblet-squat'); // MET 5, rest 90
    // first set: 40 s + 90 s rest = 130 s; gaps of 120 s and 100 s → 350 s total
    const kcal = liftingBurnForExercise(ex, [set(1, 0), set(2, 120_000), set(3, 220_000)], 100);
    expect(kcal).toBeCloseTo((4 * 100 * 350) / 3600, 1); // ≈ 38.9
  });
  it('clamps gaps and ignores incomplete sets', () => {
    const ex = getExercise('biceps-curl'); // MET 3, rest 60
    const kcal = liftingBurnForExercise(ex, [set(1, 0), set(2, 1_000), { ...set(3, 2_000), completed: false }], 100);
    // 100 s + clamped 30 s = 130 s at 2 MET-net
    expect(kcal).toBeCloseTo((2 * 100 * 130) / 3600, 1);
  });
});

describe('cardioBurn (ACSM)', () => {
  it('estimates walking, incline and running', () => {
    const flatWalk = cardioBurn(0.805, 10, 0, 100); // 3 mph → 80.5 m/min
    expect(flatWalk).toBe(40);
    expect(cardioBurn(0.805, 10, 5, 100)).toBe(76);
    expect(cardioBurn(1.34, 10, 0, 100)).toBe(134); // 5 mph jog
    expect(cardioBurn(0, 10, 0, 100)).toBe(0);
  });
});

describe('sessionBurn', () => {
  const base: WorkoutSession = {
    id: 's',
    date: '2026-09-07',
    workoutType: 'upper-a',
    planId: 'p1-upper-a',
    title: 'x',
    phase: 1,
    week: 1,
    startTime: 0,
    status: 'completed',
    exercises: [
      { exerciseId: 'goblet-squat', prescription: { sets: 3, repMin: 10, repMax: 10 }, completed: true },
      { exerciseId: 'treadmill-intervals', blockId: 'tread-intervals-10', completed: true },
    ],
    completedExercises: [],
    updatedAt: 0,
  };
  it('separates lifting from cardio and flags a missing treadmill readout', () => {
    const b = sessionBurn(base, [set(1, 0), set(2, 120_000)], 100);
    expect(b.lifting).toBeGreaterThan(20);
    expect(b.cardio).toBeGreaterThan(30);
    expect(b.total).toBe(b.lifting + b.cardio);
    expect(b.missingReadout).toEqual([1]);
  });
  it('prefers the treadmill readout when entered', () => {
    const withLog = { ...base, exercises: [base.exercises[0], { ...base.exercises[1], cardio: { distance: 0.5, incline: 2, minutes: 10, kcal: 55 } }] };
    const b = sessionBurn(withLog, [set(1, 0)], 100);
    expect(b.cardio).toBe(55);
    expect(b.missingReadout).toEqual([]);
  });
});
