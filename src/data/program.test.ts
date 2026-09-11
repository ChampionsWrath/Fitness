import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_MAP } from './exercises';
import { PLANS, resolveExercise } from './program';
import { buildBlock, blockDuration, getRunStage } from './treadmill';
import { FIGURES } from '../figures/registry';

describe('program integrity', () => {
  it('every plan references known exercises and every exercise has a figure', () => {
    for (const plan of Object.values(PLANS)) {
      for (const item of plan.items) expect(EXERCISE_MAP[item.exerciseId], item.exerciseId).toBeDefined();
    }
    for (const ex of EXERCISES) expect(FIGURES[ex.figure], ex.figure).toBeDefined();
  });
  it('all alternatives exist', () => {
    for (const ex of EXERCISES) for (const alt of ex.alternatives) expect(EXERCISE_MAP[alt], alt).toBeDefined();
  });
  it('substitutes equipment the user does not own', () => {
    expect(resolveExercise('lat-pulldown', ['dumbbells', 'treadmill'])).toEqual({ exerciseId: 'one-arm-dumbbell-row', substitutedFor: 'lat-pulldown' });
    expect(resolveExercise('lat-pulldown', ['dumbbells', 'pullup-bar'])).toEqual({ exerciseId: 'assisted-pullup', substitutedFor: 'lat-pulldown' });
    expect(resolveExercise('dumbbell-bench-press', ['dumbbells'])).toEqual({ exerciseId: 'dumbbell-floor-press', substitutedFor: 'dumbbell-bench-press' });
    expect(resolveExercise('incline-dumbbell-press', ['dumbbells', 'bench'])).toEqual({ exerciseId: 'dumbbell-bench-press', substitutedFor: 'incline-dumbbell-press' });
    expect(resolveExercise('goblet-squat', ['dumbbells'])).toEqual({ exerciseId: 'goblet-squat' });
  });
  it('never substitutes an exercise that is already in the workout', () => {
    expect(resolveExercise('lat-pulldown', ['dumbbells'], ['one-arm-dumbbell-row'])).toEqual({ exerciseId: 'dumbbell-row', substitutedFor: 'lat-pulldown' });
  });
  it('builds sessions with unique exercises', async () => {
    const { buildSessionExercises } = await import('../db/repo');
    for (const plan of Object.values(PLANS)) {
      const ids = buildSessionExercises(plan, ['dumbbells', 'treadmill'])
        .filter((e) => e.prescription)
        .map((e) => e.exerciseId);
      expect(new Set(ids).size, plan.id).toBe(ids.length);
    }
  });
});

describe('treadmill blocks', () => {
  it('builds blocks of the expected length for every week', () => {
    for (let week = 1; week <= 20; week++) {
      expect(blockDuration(buildBlock('tread-intervals-10', week))).toBe(600);
      expect(blockDuration(buildBlock('cond-intervals-20', week))).toBe(1200);
      expect(blockDuration(buildBlock('tread-hard-10', week))).toBe(600);
      expect(blockDuration(buildBlock('db-circuit-10', week))).toBe(600);
      expect(blockDuration(buildBlock('tread-steady-12', week))).toBe(720);
    }
  });
  it('does not ask for jogging in week 1', () => {
    expect(getRunStage(1).jogging).toBe(false);
    expect(getRunStage(3).jogging).toBe(true);
    expect(getRunStage(14).hardLabel).toBe('Run');
  });
});
