import { PHASES, PROGRAM_DAYS, PROGRAM_WEEKS, getPlan, phaseForWeek } from '../data/program';
import type { Phase, UserProfile, WorkoutPlan, WorkoutSession } from '../types';
import { addDays, daysBetween, startOfWeek, todayISO, weekdayOf } from './dates';

export interface ProgramPosition {
  week: number; // 1..78
  phase: Phase;
  dayIndex: number; // 0-based days since start
  daysRemaining: number;
  progress: number; // 0..1
  weekOfPhase: number;
  finished: boolean;
}

export function programPosition(startDate: string, today = todayISO()): ProgramPosition {
  const dayIndex = Math.max(0, daysBetween(startDate, today));
  const rawWeek = Math.floor(dayIndex / 7) + 1;
  const week = Math.min(PROGRAM_WEEKS, Math.max(1, rawWeek));
  const phase = phaseForWeek(week);
  return {
    week,
    phase,
    dayIndex,
    daysRemaining: Math.max(0, PROGRAM_DAYS - dayIndex),
    progress: Math.min(1, dayIndex / PROGRAM_DAYS),
    weekOfPhase: week - phase.startWeek + 1,
    finished: rawWeek > PROGRAM_WEEKS,
  };
}

export function planForDate(profile: UserProfile, date: string): WorkoutPlan {
  const pos = programPosition(profile.programStartDate, date);
  const planId = pos.phase.schedule[weekdayOf(date)] ?? 'rest';
  return getPlan(planId);
}

export function isTrainingDay(profile: UserProfile, date: string): boolean {
  const plan = planForDate(profile, date);
  return plan.type !== 'rest' && plan.type !== 'optional';
}

export function weekSchedule(profile: UserProfile, anyDateInWeek = todayISO()): { date: string; plan: WorkoutPlan }[] {
  const start = startOfWeek(anyDateInWeek);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, plan: planForDate(profile, date) };
  });
}

function completedByDate(sessions: WorkoutSession[]): Set<string> {
  return new Set(sessions.filter((s) => s.status === 'completed').map((s) => s.date));
}

/** Consecutive scheduled training days completed, counting back from today (or yesterday if today is not done yet). */
export function currentStreak(profile: UserProfile, sessions: WorkoutSession[], today = todayISO()): number {
  const done = completedByDate(sessions);
  let streak = 0;
  let date = today;
  if (!done.has(today)) date = addDays(today, -1);
  // walk back at most a year
  for (let i = 0; i < 366; i++) {
    if (daysBetween(profile.programStartDate, date) < 0) break;
    if (isTrainingDay(profile, date)) {
      if (done.has(date)) streak++;
      else break;
    } else if (done.has(date)) {
      streak++;
    }
    date = addDays(date, -1);
  }
  return streak;
}

export function missedYesterday(profile: UserProfile, sessions: WorkoutSession[], today = todayISO()): boolean {
  const y = addDays(today, -1);
  if (daysBetween(profile.programStartDate, y) < 0) return false;
  if (!isTrainingDay(profile, y)) return false;
  return !completedByDate(sessions).has(y);
}

export function weeklyCompletion(profile: UserProfile, sessions: WorkoutSession[], today = todayISO()): { done: number; scheduled: number; pct: number } {
  const week = weekSchedule(profile, today);
  const done = completedByDate(sessions);
  const training = week.filter((d) => d.plan.type !== 'rest' && d.plan.type !== 'optional');
  const completed = training.filter((d) => done.has(d.date)).length;
  return { done: completed, scheduled: training.length, pct: training.length ? completed / training.length : 0 };
}

export function monthlyCount(sessions: WorkoutSession[], today = todayISO()): number {
  const prefix = today.slice(0, 7);
  return sessions.filter((s) => s.status === 'completed' && s.date.startsWith(prefix)).length;
}

export { PHASES };
