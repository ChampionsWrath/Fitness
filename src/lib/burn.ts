import { buildBlock } from '../data/treadmill';
import { EXERCISE_MAP } from '../data/exercises';
import type { CardioLog, Exercise, ExerciseSet, Interval, Unit, WorkoutSession } from '../types';

/**
 * Calories burned, net of resting metabolism (which the daily target
 * already covers). Lifting uses MET values per exercise applied to the
 * real time between completed sets; treadmill work uses the ACSM
 * walking/running equations from distance, incline and minutes.
 */

export const DEFAULT_LIFT_MET = 3.5;
const SET_WORK_SECONDS = 40;
const MIN_SET_GAP = 30;
const MAX_SET_GAP = 300;

/** Net kcal for one exercise's completed sets. */
export function liftingBurnForExercise(exercise: Exercise | undefined, sets: ExerciseSet[], weightKg: number): number {
  const done = sets.filter((s) => s.completed && !s.duration).sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.setNumber - b.setNumber);
  if (!done.length) return 0;
  const met = exercise?.met ?? DEFAULT_LIFT_MET;
  const rest = exercise?.restSeconds ?? 90;
  let seconds = 0;
  let prev: number | undefined;
  for (const s of done) {
    if (prev !== undefined && s.completedAt != null) seconds += Math.min(MAX_SET_GAP, Math.max(MIN_SET_GAP, (s.completedAt - prev) / 1000));
    else seconds += SET_WORK_SECONDS + rest;
    if (s.completedAt != null) prev = s.completedAt;
  }
  return ((met - 1) * weightKg * seconds) / 3600;
}

export function toKm(distance: number, units: Unit): number {
  return units === 'kg' ? distance : distance * 1.609344;
}

/**
 * ACSM metabolic equations. Walking (≤ 3.7 mph): VO2 = 3.5 + 0.1·v + 1.8·v·g.
 * Running (≥ 5 mph): VO2 = 3.5 + 0.2·v + 0.9·v·g. v in m/min, g as a fraction.
 * Blended in between. Net of the 3.5 ml/kg/min resting component.
 */
export function cardioBurn(distanceKm: number, minutes: number, inclinePct: number, weightKg: number): number {
  if (distanceKm <= 0 || minutes <= 0 || weightKg <= 0) return 0;
  const v = (distanceKm * 1000) / minutes; // m/min
  const g = Math.max(0, inclinePct) / 100;
  const walk = 0.1 * v + 1.8 * v * g;
  const run = 0.2 * v + 0.9 * v * g;
  let netVo2: number;
  if (v <= 100) netVo2 = walk;
  else if (v >= 134) netVo2 = run;
  else {
    const t = (v - 100) / 34;
    netVo2 = walk * (1 - t) + run * t;
  }
  return Math.round(((netVo2 * weightKg) / 200) * minutes);
}

const MET = { easyWalk: 3.0, briskWalk: 4.5, jog: 7.5, run: 9.0, circuit: 6.0, rest: 1.0 };

export function intervalMet(iv: Interval): number {
  if (iv.intensity === 'rest') return MET.rest;
  if (iv.exerciseId) return MET.circuit;
  const l = iv.label.toLowerCase();
  if (l.includes('run')) return MET.run;
  if (l.includes('jog')) return MET.jog;
  if (iv.intensity === 'hard' || iv.intensity === 'moderate') return MET.briskWalk;
  return MET.easyWalk;
}

/** Fallback for a completed timed block with no treadmill readout: MET by interval. */
export function blockBurn(blockId: string, week: number, weightKg: number): number {
  const block = buildBlock(blockId, week);
  let kcal = 0;
  for (const iv of block.intervals) kcal += ((intervalMet(iv) - 1) * weightKg * iv.seconds) / 3600;
  return Math.round(kcal);
}

export function isTreadmill(exerciseId: string): boolean {
  return exerciseId.startsWith('treadmill') || exerciseId === 'outdoor-walk';
}

export interface SessionBurn {
  lifting: number;
  cardio: number;
  total: number;
  /** kcal per exercise index */
  perExercise: number[];
  /** exercise indexes that are treadmill blocks without a readout */
  missingReadout: number[];
}

export function sessionBurn(session: WorkoutSession, sets: ExerciseSet[], weightKg: number): SessionBurn {
  let lifting = 0;
  let cardio = 0;
  const perExercise: number[] = [];
  const missingReadout: number[] = [];
  session.exercises.forEach((ex, i) => {
    let kcal = 0;
    if (ex.prescription) {
      kcal = liftingBurnForExercise(EXERCISE_MAP[ex.exerciseId], sets.filter((s) => s.exerciseId === ex.exerciseId), weightKg);
      lifting += kcal;
    } else if (ex.blockId) {
      if (ex.cardio && ex.cardio.distance > 0) kcal = ex.cardio.kcal;
      else if (ex.completed) {
        kcal = blockBurn(ex.blockId, session.week, weightKg);
        if (isTreadmill(ex.exerciseId)) missingReadout.push(i);
      }
      cardio += kcal;
    }
    perExercise.push(Math.round(kcal));
  });
  return { lifting: Math.round(lifting), cardio: Math.round(cardio), total: Math.round(lifting) + Math.round(cardio), perExercise, missingReadout };
}

export function makeCardioLog(distance: number, incline: number, minutes: number, units: Unit, weightKg: number): CardioLog {
  return { distance, incline, minutes, kcal: cardioBurn(toKm(distance, units), minutes, incline, weightKg) };
}
