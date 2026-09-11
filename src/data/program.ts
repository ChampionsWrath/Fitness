import type { Equipment, Phase, SetPrescription, WorkoutItem, WorkoutPlan } from '../types';
import { EXERCISE_MAP } from './exercises';

const s = (exerciseId: string, sets: number, repMin: number, repMax = repMin, perSide?: boolean): WorkoutItem => ({
  type: 'strength',
  exerciseId,
  prescription: { sets, repMin, repMax, perSide } satisfies SetPrescription,
});
const t = (exerciseId: string, blockId: string): WorkoutItem => ({ type: 'timed', exerciseId, blockId });

export const PLANS: Record<string, WorkoutPlan> = {
  // ---------------------------------------------------------------- PHASE 1
  'p1-upper-a': {
    id: 'p1-upper-a',
    type: 'upper-a',
    title: 'Upper Body + Treadmill',
    subtitle: 'Chest, back, shoulders, then intervals',
    estimatedMinutes: 50,
    items: [
      s('dumbbell-bench-press', 4, 8, 12),
      s('one-arm-dumbbell-row', 4, 8, 12, true),
      s('dumbbell-shoulder-press', 3, 8, 12),
      s('lat-pulldown', 3, 8, 12),
      t('treadmill-intervals', 'tread-intervals-10'),
    ],
  },
  'p1-lower': {
    id: 'p1-lower',
    type: 'lower',
    title: 'Lower Body + Treadmill',
    subtitle: 'Legs and glutes, then a steady walk',
    estimatedMinutes: 50,
    items: [
      s('goblet-squat', 4, 10),
      s('romanian-deadlift', 3, 10),
      s('walking-lunge', 3, 10, 10, true),
      s('calf-raise', 3, 15),
      t('treadmill-walk', 'tread-steady-12'),
    ],
  },
  'p1-conditioning': {
    id: 'p1-conditioning',
    type: 'conditioning',
    title: 'Conditioning',
    subtitle: 'Treadmill intervals and a dumbbell circuit',
    estimatedMinutes: 40,
    items: [
      t('treadmill-walk', 'cond-warmup-5'),
      t('treadmill-intervals', 'cond-intervals-20'),
      t('goblet-squat', 'db-circuit-10'),
      t('treadmill-walk', 'cond-cooldown-5'),
    ],
  },
  'p1-upper-b': {
    id: 'p1-upper-b',
    type: 'upper-b',
    title: 'Upper Body + Treadmill',
    subtitle: 'Incline press, rows, shoulders and arms',
    estimatedMinutes: 55,
    items: [
      s('incline-dumbbell-press', 4, 8, 12),
      s('dumbbell-row', 4, 8, 12),
      s('lateral-raise', 3, 12, 15),
      s('biceps-curl', 3, 10, 12),
      s('triceps-extension', 3, 10, 12),
      t('treadmill-intervals', 'tread-intervals-10'),
    ],
  },
  'p1-full-body': {
    id: 'p1-full-body',
    type: 'full-body',
    title: 'Full Body',
    subtitle: 'Every major muscle, then hard conditioning',
    estimatedMinutes: 50,
    items: [
      s('dumbbell-squat', 3, 10),
      s('dumbbell-bench-press', 3, 10),
      s('dumbbell-row', 3, 10),
      s('romanian-deadlift', 3, 10),
      s('dumbbell-shoulder-press', 3, 10),
      t('treadmill-intervals', 'tread-hard-10'),
    ],
  },
  optional: {
    id: 'optional',
    type: 'optional',
    title: 'Optional Activity',
    subtitle: 'Easy movement if you feel like it',
    estimatedMinutes: 20,
    items: [t('treadmill-walk', 'optional-walk-20')],
  },
  rest: {
    id: 'rest',
    type: 'rest',
    title: 'Rest Day',
    subtitle: 'Recovery is part of the program',
    estimatedMinutes: 0,
    items: [],
  },
  // ---------------------------------------------------------------- PHASE 2 (upper/lower split)
  'p2-upper-a': {
    id: 'p2-upper-a',
    type: 'upper',
    title: 'Upper A',
    subtitle: 'Heavier pressing and rowing',
    estimatedMinutes: 55,
    items: [
      s('dumbbell-bench-press', 4, 6, 10),
      s('one-arm-dumbbell-row', 4, 8, 12, true),
      s('dumbbell-shoulder-press', 3, 8, 12),
      s('lat-pulldown', 3, 8, 12),
      s('biceps-curl', 3, 10, 12),
      s('triceps-extension', 3, 10, 12),
    ],
  },
  'p2-lower-a': {
    id: 'p2-lower-a',
    type: 'lower',
    title: 'Lower A',
    subtitle: 'Squat focus',
    estimatedMinutes: 50,
    items: [s('dumbbell-squat', 4, 8, 10), s('romanian-deadlift', 3, 8, 10), s('walking-lunge', 3, 10, 12, true), s('calf-raise', 4, 12, 15)],
  },
  'p2-upper-b': {
    id: 'p2-upper-b',
    type: 'upper',
    title: 'Upper B',
    subtitle: 'Incline pressing, rows and shoulders',
    estimatedMinutes: 55,
    items: [
      s('incline-dumbbell-press', 4, 8, 12),
      s('dumbbell-row', 4, 8, 12),
      s('lateral-raise', 4, 12, 15),
      s('lat-pulldown', 3, 10, 12),
      s('biceps-curl', 3, 10, 12),
      s('triceps-extension', 3, 10, 12),
    ],
  },
  'p2-lower-b': {
    id: 'p2-lower-b',
    type: 'lower-2',
    title: 'Lower B',
    subtitle: 'Hinge focus',
    estimatedMinutes: 50,
    items: [s('romanian-deadlift', 4, 8, 10), s('goblet-squat', 3, 10, 12), s('walking-lunge', 3, 10, 12, true), s('calf-raise', 4, 12, 15)],
  },
  'p2-conditioning': {
    id: 'p2-conditioning',
    type: 'conditioning',
    title: 'Conditioning',
    subtitle: 'Longer treadmill intervals',
    estimatedMinutes: 35,
    items: [t('treadmill-walk', 'cond-warmup-5'), t('treadmill-intervals', 'cond-intervals-25'), t('treadmill-walk', 'cond-cooldown-5')],
  },
};

export const PROGRAM_WEEKS = 78;
export const PROGRAM_DAYS = PROGRAM_WEEKS * 7;

export const PHASES: Phase[] = [
  {
    id: 1,
    name: 'Foundation',
    monthsLabel: 'Months 1–3',
    startWeek: 1,
    endWeek: 13,
    description: 'Learn the movements, build the habit, and walk your way toward running a 5K. Five training days a week.',
    focus: ['Technique', 'Consistency', 'Walk-to-run'],
    schedule: { 1: 'p1-upper-a', 2: 'p1-lower', 3: 'p1-conditioning', 4: 'p1-upper-b', 5: 'p1-full-body', 6: 'optional', 0: 'rest' },
    configured: true,
  },
  {
    id: 2,
    name: 'Build',
    monthsLabel: 'Months 4–9',
    startWeek: 14,
    endWeek: 39,
    description: 'Four lifting days on an upper/lower split plus two conditioning days. Heavier weights, lower reps on the big lifts.',
    focus: ['Strength', 'Upper / Lower split', 'Continuous running'],
    schedule: { 1: 'p2-upper-a', 2: 'p2-lower-a', 3: 'p2-conditioning', 4: 'p2-upper-b', 5: 'p2-lower-b', 6: 'p2-conditioning', 0: 'rest' },
    configured: true,
  },
  {
    id: 3,
    name: 'Sculpt',
    monthsLabel: 'Months 10–18',
    startWeek: 40,
    endWeek: 78,
    description: 'Progressive strength and physique training with focus on chest, shoulders, back, arms, legs and core while keeping conditioning. Detailed programming for this phase will be added later; the Phase 2 split continues until then.',
    focus: ['Chest', 'Shoulders', 'Back', 'Arms', 'Legs', 'Core'],
    schedule: { 1: 'p2-upper-a', 2: 'p2-lower-a', 3: 'p2-conditioning', 4: 'p2-upper-b', 5: 'p2-lower-b', 6: 'p2-conditioning', 0: 'rest' },
    configured: false,
  },
];

export function phaseForWeek(week: number): Phase {
  return PHASES.find((p) => week >= p.startWeek && week <= p.endWeek) ?? PHASES[PHASES.length - 1];
}

export function getPlan(id: string): WorkoutPlan {
  const plan = PLANS[id];
  if (!plan) throw new Error(`Unknown plan ${id}`);
  return plan;
}

/** Pick the best exercise the user can actually do with their equipment. */
export function resolveExercise(
  exerciseId: string,
  equipment: Equipment[],
  /** exercises already in the workout: a substitute never duplicates one of these */
  exclude: string[] = [],
): { exerciseId: string; substitutedFor?: string } {
  const has = (id: string) => EXERCISE_MAP[id]?.equipment.every((e) => equipment.includes(e)) ?? false;
  if (has(exerciseId)) return { exerciseId };
  const visited = new Set<string>([exerciseId]);
  const queue = [...(EXERCISE_MAP[exerciseId]?.alternatives ?? [])];
  while (queue.length) {
    const alt = queue.shift()!;
    if (visited.has(alt)) continue;
    visited.add(alt);
    if (has(alt) && !exclude.includes(alt)) return { exerciseId: alt, substitutedFor: exerciseId };
    queue.push(...(EXERCISE_MAP[alt]?.alternatives ?? []));
  }
  return { exerciseId };
}
