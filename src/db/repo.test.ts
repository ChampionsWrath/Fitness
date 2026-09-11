import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { getSetsForSession, logPastWorkout } from './repo';

async function wipeLocal() {
  await db.delete();
  await db.open();
}

describe('logPastWorkout', () => {
  beforeEach(wipeLocal);

  it('saves a completed, backdated session with estimated burn and no set timing', async () => {
    const session = await logPastWorkout({
      date: '2026-08-01',
      title: 'Upper body',
      exercises: [{ exerciseId: 'dumbbell-bench-press', sets: [{ weight: 35, reps: 12 }, { weight: 35, reps: 12 }] }],
      weightKg: 90,
    });

    expect(session.date).toBe('2026-08-01');
    expect(session.status).toBe('completed');
    expect(session.title).toBe('Upper body');
    expect(session.caloriesBurned).toBeGreaterThan(0);
    expect(session.burnLifting).toBe(session.caloriesBurned);
    expect(session.endTime).toBeGreaterThan(session.startTime);

    const stored = await db.sessions.get(session.id);
    expect(stored?.exercises[0].exerciseId).toBe('dumbbell-bench-press');

    const sets = await getSetsForSession(session.id);
    expect(sets).toHaveLength(2);
    expect(sets.every((s) => s.completed && s.completedAt === undefined)).toBe(true);
    expect(sets.map((s) => s.reps)).toEqual([12, 12]);
  });

  it('drops exercises with no valid sets and defaults the title', async () => {
    const session = await logPastWorkout({
      date: '2026-08-02',
      title: '',
      exercises: [{ exerciseId: 'dumbbell-bench-press', sets: [] }],
      weightKg: 90,
    });

    expect(session.title).toBe('Logged workout');
    expect(session.exercises).toHaveLength(0);
    expect(session.caloriesBurned).toBe(0);
    expect(await getSetsForSession(session.id)).toHaveLength(0);
  });
});
