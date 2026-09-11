import { EXERCISE_MAP } from '../data/exercises';
import { resolveExercise } from '../data/program';
import { liftingBurnForExercise } from '../lib/burn';
import { programPosition } from '../lib/schedule';
import { newId } from '../lib/ids';
import { todayISO } from '../lib/dates';
import type {
  CardioLog,
  Equipment,
  ExerciseSet,
  FoodEntry,
  FoodItem,
  StepEntry,
  PhotoView,
  ProgressPhoto,
  SessionExercise,
  TimerState,
  UserProfile,
  WaistEntry,
  WeightEntry,
  WorkoutPlan,
  WorkoutSession,
} from '../types';
import { db } from './db';

// ---------------------------------------------------------------- profile
export async function getProfile(): Promise<UserProfile | undefined> {
  return db.profile.get('me');
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await db.profile.put({ ...profile, updatedAt: Date.now() });
}

export function defaultProfile(): UserProfile {
  return {
    id: 'me',
    units: 'lb',
    startWeight: 0,
    goalWeight: 0,
    equipment: ['dumbbells', 'treadmill'],
    daysPerWeek: 5,
    typicalDurationMin: 45,
    programStartDate: todayISO(),
    theme: 'system',
    defaultRestSeconds: 90,
    onboardingComplete: false,
    disclaimerAccepted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------- sessions
export function buildSessionExercises(plan: WorkoutPlan, equipment: Equipment[]): SessionExercise[] {
  const used = plan.items.filter((i) => i.type === 'strength').map((i) => i.exerciseId);
  return plan.items.map((item) => {
    const r = resolveExercise(item.exerciseId, equipment, item.type === 'strength' ? used : []);
    if (item.type === 'strength') used.push(r.exerciseId);
    if (item.type === 'strength') {
      return { exerciseId: r.exerciseId, substitutedFor: r.substitutedFor, prescription: item.prescription, completed: false };
    }
    return { exerciseId: r.exerciseId, substitutedFor: r.substitutedFor, blockId: item.blockId, completed: false };
  });
}

export async function startSession(plan: WorkoutPlan, profile: UserProfile, date = todayISO()): Promise<WorkoutSession> {
  const pos = programPosition(profile.programStartDate, date);
  const session: WorkoutSession = {
    id: newId(),
    date,
    workoutType: plan.type,
    planId: plan.id,
    title: plan.title,
    phase: pos.phase.id,
    week: pos.week,
    startTime: Date.now(),
    status: 'in-progress',
    exercises: buildSessionExercises(plan, profile.equipment),
    completedExercises: [],
    updatedAt: Date.now(),
  };
  await db.sessions.put(session);
  // Prefill sets from history so the user sees what they did last time.
  const sets: ExerciseSet[] = [];
  for (const ex of session.exercises) {
    if (!ex.prescription) continue;
    const last = await getLastSetsForExercise(ex.exerciseId, session.id);
    const exercise = EXERCISE_MAP[ex.exerciseId];
    const fallbackWeight = exercise ? defaultWeightFor(exercise.defaultWeightLb, profile.units) : 0;
    for (let i = 1; i <= ex.prescription.sets; i++) {
      const prev = last.find((s) => s.setNumber === i) ?? last[last.length - 1];
      sets.push({
        id: newId(),
        sessionId: session.id,
        exerciseId: ex.exerciseId,
        date,
        setNumber: i,
        weight: prev ? prev.weight : fallbackWeight,
        reps: prev ? prev.reps : ex.prescription.repMin,
        completed: false,
        updatedAt: Date.now(),
      });
    }
  }
  if (sets.length) await db.sets.bulkPut(sets);
  return session;
}

export function defaultWeightFor(lb: number, units: 'lb' | 'kg'): number {
  if (units === 'lb') return lb;
  return Math.round((lb * 0.4536) / 2.5) * 2.5 || (lb > 0 ? 2.5 : 0);
}

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  return db.sessions.where('status').equals('in-progress').first();
}

export async function getSession(id: string): Promise<WorkoutSession | undefined> {
  return db.sessions.get(id);
}

export async function updateSession(session: WorkoutSession): Promise<void> {
  await db.sessions.put({ ...session, updatedAt: Date.now() });
}

export async function markExerciseComplete(sessionId: string, index: number, completed: boolean): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const exercises = s.exercises.map((e, i) => (i === index ? { ...e, completed } : e));
  const completedExercises = exercises.filter((e) => e.completed).map((e) => e.exerciseId);
  await db.sessions.put({ ...s, exercises, completedExercises, updatedAt: Date.now() });
}

export async function finishSession(sessionId: string, notes?: string, burn?: { lifting: number; cardio: number; total: number }): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  // Sets that were never completed are dropped so they do not pollute history.
  await db.sets.where('sessionId').equals(sessionId).and((x) => !x.completed).delete();
  const remaining = await db.sets.where('sessionId').equals(sessionId).toArray();
  const doneIds = new Set(remaining.map((x) => x.exerciseId));
  const exercises = s.exercises.map((e) => ({ ...e, completed: e.completed || doneIds.has(e.exerciseId) }));
  await db.sessions.put({
    ...s,
    exercises,
    completedExercises: exercises.filter((e) => e.completed).map((e) => e.exerciseId),
    endTime: Date.now(),
    status: 'completed',
    notes,
    caloriesBurned: burn ? Math.round(burn.total) : undefined,
    burnLifting: burn ? Math.round(burn.lifting) : undefined,
    burnCardio: burn ? Math.round(burn.cardio) : undefined,
    updatedAt: Date.now(),
  });
  await clearTimer();
}

/** Save what the treadmill display showed for one block; recomputes stored totals on completed sessions. */
export async function saveCardioLog(sessionId: string, index: number, cardio: CardioLog | undefined, recompute?: (s: WorkoutSession, sets: ExerciseSet[]) => { lifting: number; cardio: number; total: number }): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const exercises = s.exercises.map((e, i) => (i === index ? { ...e, cardio, completed: e.completed || !!(cardio && cardio.distance > 0) } : e));
  let next: WorkoutSession = { ...s, exercises, completedExercises: exercises.filter((e) => e.completed).map((e) => e.exerciseId), updatedAt: Date.now() };
  if (s.status === 'completed' && recompute) {
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    const b = recompute(next, sets);
    next = { ...next, caloriesBurned: Math.round(b.total), burnLifting: Math.round(b.lifting), burnCardio: Math.round(b.cardio) };
  }
  await db.sessions.put(next);
}

export async function abandonSession(sessionId: string): Promise<void> {
  await db.sets.where('sessionId').equals(sessionId).delete();
  await db.sessions.delete(sessionId);
  await clearTimer();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.sets.where('sessionId').equals(sessionId).delete();
  await db.sessions.delete(sessionId);
}

export async function listCompletedSessions(): Promise<WorkoutSession[]> {
  const all = await db.sessions.where('status').equals('completed').toArray();
  return all.sort((a, b) => b.startTime - a.startTime);
}

/**
 * Record a workout that already happened but was never logged (backfill after a
 * missed day, a wipe, or a forgotten entry). There is no real set-by-set timing to
 * work from, so `liftingBurnForExercise` falls back to its typical work+rest
 * estimate per set (the same fallback it uses for any set with no `completedAt`).
 */
export async function logPastWorkout(input: { date: string; title: string; exercises: { exerciseId: string; sets: { weight: number; reps: number }[] }[]; weightKg: number }): Promise<WorkoutSession> {
  const sessionId = newId();
  const now = Date.now();
  const allSets: ExerciseSet[] = [];
  const exercises: SessionExercise[] = [];
  let liftingKcal = 0;
  let estSeconds = 0;
  for (const ex of input.exercises) {
    if (!ex.sets.length) continue;
    const def = EXERCISE_MAP[ex.exerciseId];
    const exSets: ExerciseSet[] = ex.sets.map((s, i) => ({
      id: newId(),
      sessionId,
      exerciseId: ex.exerciseId,
      date: input.date,
      setNumber: i + 1,
      weight: s.weight,
      reps: s.reps,
      completed: true,
      updatedAt: now,
    }));
    allSets.push(...exSets);
    liftingKcal += liftingBurnForExercise(def, exSets, input.weightKg);
    estSeconds += ex.sets.length * (40 + (def?.restSeconds ?? 90));
    const reps = ex.sets.map((s) => s.reps);
    exercises.push({ exerciseId: ex.exerciseId, prescription: { sets: ex.sets.length, repMin: Math.min(...reps), repMax: Math.max(...reps) }, completed: true });
  }
  const startTime = new Date(`${input.date}T12:00:00`).getTime();
  const session: WorkoutSession = {
    id: sessionId,
    date: input.date,
    workoutType: 'optional',
    planId: 'manual',
    title: input.title || 'Logged workout',
    phase: 1,
    week: 1,
    startTime,
    endTime: startTime + estSeconds * 1000,
    status: 'completed',
    exercises,
    completedExercises: exercises.map((e) => e.exerciseId),
    caloriesBurned: Math.round(liftingKcal),
    burnLifting: Math.round(liftingKcal),
    burnCardio: 0,
    updatedAt: now,
  };
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.put(session);
    if (allSets.length) await db.sets.bulkPut(allSets);
  });
  return session;
}

// ---------------------------------------------------------------- sets
export async function getSetsForSession(sessionId: string): Promise<ExerciseSet[]> {
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
  return sets.sort((a, b) => a.exerciseId.localeCompare(b.exerciseId) || a.setNumber - b.setNumber);
}

export async function saveSet(set: ExerciseSet): Promise<void> {
  await db.sets.put({ ...set, updatedAt: Date.now() });
}

/** Completed sets from the most recent *completed* session that included this exercise. */
export async function getLastSetsForExercise(exerciseId: string, excludeSessionId?: string): Promise<ExerciseSet[]> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).and((s) => s.completed && s.sessionId !== excludeSessionId).toArray();
  if (!sets.length) return [];
  // group by session, choose the newest by date/completedAt
  const bySession = new Map<string, ExerciseSet[]>();
  for (const s of sets) {
    const arr = bySession.get(s.sessionId) ?? [];
    arr.push(s);
    bySession.set(s.sessionId, arr);
  }
  let best: ExerciseSet[] = [];
  let bestKey = '';
  for (const arr of bySession.values()) {
    const key = `${arr[0].date}-${String(Math.max(...arr.map((x) => x.completedAt ?? 0))).padStart(15, '0')}`;
    if (key > bestKey) {
      bestKey = key;
      best = arr;
    }
  }
  return best.sort((a, b) => a.setNumber - b.setNumber);
}

export async function getAllCompletedSets(): Promise<ExerciseSet[]> {
  return db.sets.filter((s) => s.completed).toArray();
}

export async function getHistoryForExercise(exerciseId: string): Promise<ExerciseSet[]> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).and((s) => s.completed).toArray();
  return sets.sort((a, b) => b.date.localeCompare(a.date) || a.setNumber - b.setNumber);
}

// ---------------------------------------------------------------- body measurements
export async function upsertWeight(date: string, weight: number): Promise<void> {
  const existing = await db.weights.where('date').equals(date).first();
  await db.weights.put({ id: existing?.id ?? newId(), date, weight, updatedAt: Date.now() });
}

export async function upsertWaist(date: string, waist: number): Promise<void> {
  const existing = await db.waists.where('date').equals(date).first();
  await db.waists.put({ id: existing?.id ?? newId(), date, waist, updatedAt: Date.now() });
}

export async function deleteWeight(id: string): Promise<void> {
  await db.weights.delete(id);
}

export async function deleteWaist(id: string): Promise<void> {
  await db.waists.delete(id);
}

export async function listWeights(): Promise<WeightEntry[]> {
  return (await db.weights.toArray()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function listWaists(): Promise<WaistEntry[]> {
  return (await db.waists.toArray()).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------- photos
export async function addPhoto(date: string, view: PhotoView, blob: Blob, width: number, height: number): Promise<ProgressPhoto> {
  const photo: ProgressPhoto = { id: newId(), date, view, blob, width, height, updatedAt: Date.now() };
  await db.photos.put(photo);
  return photo;
}

export async function listPhotos(): Promise<ProgressPhoto[]> {
  return (await db.photos.toArray()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

// ---------------------------------------------------------------- timers (survive reloads / lock screen)
export async function setTimer(state: TimerState): Promise<void> {
  await db.meta.put({ key: 'timer', value: state });
}

export async function getTimer(): Promise<TimerState | undefined> {
  const m = await db.meta.get('timer');
  return m?.value as TimerState | undefined;
}

export async function clearTimer(): Promise<void> {
  await db.meta.delete('timer');
}

// ---------------------------------------------------------------- food
export async function addFoodEntry(entry: Omit<FoodEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<FoodEntry> {
  const full: FoodEntry = { ...entry, id: newId(), createdAt: Date.now(), updatedAt: Date.now() };
  await db.foodEntries.put(full);
  return full;
}

export async function updateFoodEntry(entry: FoodEntry): Promise<void> {
  await db.foodEntries.put({ ...entry, updatedAt: Date.now() });
}

export async function deleteFoodEntry(id: string): Promise<void> {
  await db.foodEntries.delete(id);
}

export async function listFoodEntries(date: string): Promise<FoodEntry[]> {
  const rows = await db.foodEntries.where('date').equals(date).toArray();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listFoodEntriesBetween(from: string, to: string): Promise<FoodEntry[]> {
  return db.foodEntries.where('date').between(from, to, true, true).toArray();
}

/** Most recently logged distinct foods, newest first. */
export async function recentFoods(limit = 12): Promise<FoodEntry[]> {
  const rows = await db.foodEntries.orderBy('createdAt').reverse().limit(200).toArray();
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (const r of rows) {
    const key = r.foodId ?? r.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

export async function saveCustomFood(food: FoodItem): Promise<void> {
  await db.foods.put({ ...food, custom: true, updatedAt: Date.now() });
}

export async function deleteCustomFood(id: string): Promise<void> {
  await db.foods.delete(id);
}

export async function listCustomFoods(): Promise<FoodItem[]> {
  return (await db.foods.toArray()).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- steps
export async function upsertSteps(date: string, steps: number): Promise<void> {
  const existing = await db.steps.where('date').equals(date).first();
  if (steps <= 0) {
    if (existing) await db.steps.delete(existing.id);
    return;
  }
  await db.steps.put({ id: existing?.id ?? newId(), date, steps: Math.round(steps), updatedAt: Date.now() });
}

export async function getSteps(date: string): Promise<StepEntry | undefined> {
  return db.steps.where('date').equals(date).first();
}

export async function listStepsBetween(from: string, to: string): Promise<StepEntry[]> {
  return db.steps.where('date').between(from, to, true, true).toArray();
}

export async function listAllSteps(): Promise<StepEntry[]> {
  return (await db.steps.toArray()).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------- export / import / reset
export interface ExportBundle {
  version: 1 | 2;
  exportedAt: string;
  profile?: UserProfile;
  sessions: WorkoutSession[];
  sets: ExerciseSet[];
  weights: WeightEntry[];
  waists: WaistEntry[];
  foods?: FoodItem[];
  foodEntries?: FoodEntry[];
  steps?: StepEntry[];
}

export async function exportAll(): Promise<ExportBundle> {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: await getProfile(),
    sessions: await db.sessions.toArray(),
    sets: await db.sets.toArray(),
    weights: await db.weights.toArray(),
    waists: await db.waists.toArray(),
    foods: await db.foods.toArray(),
    foodEntries: await db.foodEntries.toArray(),
    steps: await db.steps.toArray(),
  };
}

export async function importAll(bundle: ExportBundle): Promise<void> {
  await db.transaction('rw', [db.profile, db.sessions, db.sets, db.weights, db.waists, db.foods, db.foodEntries, db.steps], async () => {
    if (bundle.profile) await db.profile.put(bundle.profile);
    await db.sessions.bulkPut(bundle.sessions ?? []);
    await db.sets.bulkPut(bundle.sets ?? []);
    await db.weights.bulkPut(bundle.weights ?? []);
    await db.waists.bulkPut(bundle.waists ?? []);
    await db.foods.bulkPut(bundle.foods ?? []);
    await db.foodEntries.bulkPut(bundle.foodEntries ?? []);
    await db.steps.bulkPut(bundle.steps ?? []);
  });
}

export async function resetAll(): Promise<void> {
  await db.delete();
  await db.open();
}
