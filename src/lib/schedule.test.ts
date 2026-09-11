import { describe, expect, it } from 'vitest';
import { defaultProfile } from '../db/repo';
import { currentStreak, missedYesterday, planForDate, programPosition, weeklyCompletion } from './schedule';
import type { WorkoutSession } from '../types';

const profile = { ...defaultProfile(), programStartDate: '2026-08-31' }; // a Monday

const done = (date: string): WorkoutSession => ({
  id: date,
  date,
  workoutType: 'upper-a',
  planId: 'p1-upper-a',
  title: 'x',
  phase: 1,
  week: 1,
  startTime: 0,
  status: 'completed',
  exercises: [],
  completedExercises: [],
  updatedAt: 0,
});

describe('programPosition', () => {
  it('starts on week 1 of phase 1', () => {
    const p = programPosition('2026-08-31', '2026-08-31');
    expect(p.week).toBe(1);
    expect(p.phase.id).toBe(1);
    expect(p.daysRemaining).toBe(546);
  });
  it('moves through the phases by week', () => {
    expect(programPosition('2026-08-31', '2026-11-30').week).toBe(14);
    expect(programPosition('2026-08-31', '2026-11-30').phase.id).toBe(2);
    expect(programPosition('2026-08-31', '2027-06-07').phase.id).toBe(3);
  });
  it('caps at the end of the program', () => {
    const p = programPosition('2026-08-31', '2030-01-01');
    expect(p.week).toBe(78);
    expect(p.daysRemaining).toBe(0);
    expect(p.finished).toBe(true);
  });
});

describe('planForDate', () => {
  it('follows the weekday schedule', () => {
    expect(planForDate(profile, '2026-08-31').id).toBe('p1-upper-a');
    expect(planForDate(profile, '2026-09-01').id).toBe('p1-lower');
    expect(planForDate(profile, '2026-09-02').id).toBe('p1-conditioning');
    expect(planForDate(profile, '2026-09-03').id).toBe('p1-upper-b');
    expect(planForDate(profile, '2026-09-04').id).toBe('p1-full-body');
    expect(planForDate(profile, '2026-09-05').id).toBe('optional');
    expect(planForDate(profile, '2026-09-06').id).toBe('rest');
  });
});

describe('streaks', () => {
  it('counts consecutive training days, skipping rest days', () => {
    const sessions = [done('2026-09-03'), done('2026-09-04')];
    // Sunday 9/6: yesterday (Sat) is optional, Fri + Thu done, Wed missed
    expect(currentStreak(profile, sessions, '2026-09-06')).toBe(2);
    expect(missedYesterday(profile, sessions, '2026-09-06')).toBe(false);
    expect(missedYesterday(profile, [done('2026-09-04')], '2026-09-03')).toBe(true);
  });
  it('computes weekly completion against scheduled training days', () => {
    const w = weeklyCompletion(profile, [done('2026-08-31'), done('2026-09-01')], '2026-09-02');
    expect(w.scheduled).toBe(5);
    expect(w.done).toBe(2);
  });
});
