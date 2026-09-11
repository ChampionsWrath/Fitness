import { describe, expect, it } from 'vitest';
import { getExercise } from '../data/exercises';
import { computePRs, getRecommendation } from './overload';
import type { ExerciseSet } from '../types';

const ex = getExercise('dumbbell-bench-press');
const rx = { sets: 4, repMin: 8, repMax: 12 };
const mk = (reps: number[], weight = 35): ExerciseSet[] =>
  reps.map((r, i) => ({
    id: `s${i}`,
    sessionId: 'a',
    exerciseId: ex.id,
    date: '2026-09-01',
    setNumber: i + 1,
    weight,
    reps: r,
    completed: true,
    updatedAt: 0,
  }));

describe('getRecommendation', () => {
  it('returns null with no history', () => {
    expect(getRecommendation(ex, rx, [], 'lb')).toBeNull();
  });
  it('recommends an increase when every set hits the top of the range', () => {
    const r = getRecommendation(ex, rx, mk([12, 12, 12, 12]), 'lb');
    expect(r?.kind).toBe('increase');
    expect(r?.suggestedWeight).toBe(40);
    expect(r?.message).toContain('35 lb → 40 lb');
  });
  it('holds when a set falls below the minimum', () => {
    const r = getRecommendation(ex, rx, mk([12, 10, 9, 7]), 'lb');
    expect(r?.kind).toBe('hold');
    expect(r?.suggestedWeight).toBe(35);
  });
  it('asks to push when within range but not at the top', () => {
    const r = getRecommendation(ex, rx, mk([12, 12, 11, 10]), 'lb');
    expect(r?.kind).toBe('push');
  });
  it('does not recommend an increase if fewer sets were completed', () => {
    const r = getRecommendation(ex, rx, mk([12, 12, 12]), 'lb');
    expect(r?.kind).toBe('push');
  });
  it('uses smaller increments for light exercises and kg', () => {
    const lat = getExercise('lateral-raise');
    const r = getRecommendation(lat, { sets: 3, repMin: 12, repMax: 15 }, mk([15, 15, 15], 10).map((s) => ({ ...s, exerciseId: lat.id })), 'kg');
    expect(r?.suggestedWeight).toBe(11);
  });
});

describe('computePRs', () => {
  it('keeps the best estimated 1RM per exercise', () => {
    const prs = computePRs([...mk([10], 35), ...mk([8], 40).map((s) => ({ ...s, id: 'x', date: '2026-09-03' }))]);
    expect(prs[ex.id].weight).toBe(40);
    expect(prs[ex.id].date).toBe('2026-09-03');
  });
});
