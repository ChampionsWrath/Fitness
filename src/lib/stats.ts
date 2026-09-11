import { daysBetween } from './dates';

export interface Point {
  date: string;
  value: number;
}

/** 7-day trailing moving average by calendar window (robust to missing days). */
export function movingAverage(points: Point[], days = 7): Point[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      if (daysBetween(sorted[j].date, p.date) >= days) break;
      sum += sorted[j].value;
      n++;
    }
    return { date: p.date, value: sum / n };
  });
}

export interface WeightSummary {
  current: number | null;
  currentDate: string | null;
  start: number | null;
  lowest: number | null;
  totalLost: number | null;
  weeklyChange: number | null; // negative = losing
  trend: number | null; // latest 7-day average
}

export function summarizeWeights(points: Point[], startWeight?: number): WeightSummary {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) {
    return { current: null, currentDate: null, start: startWeight ?? null, lowest: null, totalLost: null, weeklyChange: null, trend: null };
  }
  const start = startWeight ?? sorted[0].value;
  const current = sorted[sorted.length - 1].value;
  const lowest = Math.min(...sorted.map((p) => p.value));
  const avg = movingAverage(sorted);
  const trend = avg[avg.length - 1].value;
  let weeklyChange: number | null = null;
  const last = avg[avg.length - 1];
  const span = daysBetween(avg[0].date, last.date);
  if (span >= 7) {
    // compare the latest trend value to the trend value ~28 days ago (or the oldest available)
    let ref = avg[0];
    for (const p of avg) {
      if (daysBetween(p.date, last.date) >= 28) ref = p;
      else break;
    }
    const weeks = daysBetween(ref.date, last.date) / 7;
    if (weeks > 0) weeklyChange = (last.value - ref.value) / weeks;
  }
  return { current, currentDate: sorted[sorted.length - 1].date, start, lowest, totalLost: start - current, weeklyChange, trend };
}
