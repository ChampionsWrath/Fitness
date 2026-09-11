import type { Interval, TimedBlock } from '../types';

/**
 * 13-week progression from walking to running a 5K, mapped to the Phase 1
 * program week. Nobody is expected to run continuously on day one.
 */
export interface RunStage {
  stage: number;
  weeks: [number, number];
  title: string;
  hardLabel: string;
  hardSeconds: number;
  easyLabel: string;
  easySeconds: number;
  summary: string;
  jogging: boolean;
}

export const RUN_STAGES: RunStage[] = [
  { stage: 1, weeks: [1, 2], title: 'Walk intervals', hardLabel: 'Brisk walk', hardSeconds: 60, easyLabel: 'Easy walk', easySeconds: 60, summary: '1:00 easy walk / 1:00 brisk walk', jogging: false },
  { stage: 2, weeks: [3, 4], title: 'First jogs', hardLabel: 'Jog', hardSeconds: 60, easyLabel: 'Walk', easySeconds: 90, summary: '1:30 walk / 1:00 jog', jogging: true },
  { stage: 3, weeks: [5, 6], title: 'Longer jogs', hardLabel: 'Jog', hardSeconds: 90, easyLabel: 'Walk', easySeconds: 90, summary: '1:30 walk / 1:30 jog', jogging: true },
  { stage: 4, weeks: [7, 8], title: 'Two-minute jogs', hardLabel: 'Jog', hardSeconds: 120, easyLabel: 'Walk', easySeconds: 60, summary: '1:00 walk / 2:00 jog', jogging: true },
  { stage: 5, weeks: [9, 10], title: 'Three-minute jogs', hardLabel: 'Jog', hardSeconds: 180, easyLabel: 'Walk', easySeconds: 60, summary: '1:00 walk / 3:00 jog', jogging: true },
  { stage: 6, weeks: [11, 11], title: 'Five-minute jogs', hardLabel: 'Jog', hardSeconds: 300, easyLabel: 'Walk', easySeconds: 60, summary: '1:00 walk / 5:00 jog', jogging: true },
  { stage: 7, weeks: [12, 13], title: 'Nearly continuous', hardLabel: 'Jog', hardSeconds: 480, easyLabel: 'Walk', easySeconds: 60, summary: '1:00 walk / 8:00 jog', jogging: true },
  { stage: 8, weeks: [14, 78], title: 'Continuous running', hardLabel: 'Run', hardSeconds: 1500, easyLabel: 'Walk', easySeconds: 60, summary: 'Continuous easy running (5K ready)', jogging: true },
];

export function getRunStage(week: number): RunStage {
  return RUN_STAGES.find((s) => week >= s.weeks[0] && week <= s.weeks[1]) ?? RUN_STAGES[RUN_STAGES.length - 1];
}

/** 0..1 progress through the 5K plan. */
export function runProgress(week: number): number {
  return Math.min(1, Math.max(0, (week - 1) / 13));
}

function fill(total: number, easy: Interval, hard: Interval, startEasy = true): Interval[] {
  const out: Interval[] = [];
  let t = 0;
  let easyTurn = startEasy;
  while (t < total) {
    const src = easyTurn ? easy : hard;
    const secs = Math.min(src.seconds, total - t);
    if (secs < 20 && out.length) {
      out[out.length - 1] = { ...out[out.length - 1], seconds: out[out.length - 1].seconds + secs };
    } else {
      out.push({ ...src, seconds: secs });
    }
    t += secs;
    easyTurn = !easyTurn;
  }
  return out;
}

const walkEasy: Interval = { label: 'Easy walk', seconds: 60, intensity: 'easy', cue: 'Relaxed pace. You could chat easily.' };

function stageIntervals(week: number, totalSeconds: number, opts: { hardScale?: number; easyScale?: number } = {}): Interval[] {
  const st = getRunStage(week);
  const easy: Interval = {
    label: st.easyLabel,
    seconds: Math.round(st.easySeconds * (opts.easyScale ?? 1)),
    intensity: 'easy',
    cue: 'Catch your breath. Keep moving.',
  };
  const hard: Interval = {
    label: st.hardLabel,
    seconds: Math.round(st.hardSeconds * (opts.hardScale ?? 1)),
    intensity: st.jogging ? 'hard' : 'moderate',
    cue: st.jogging ? 'Easy jog. Short sentences only.' : 'Walk fast. Pump your arms.',
  };
  return fill(totalSeconds, easy, hard);
}

export function buildBlock(blockId: string, week: number): TimedBlock {
  const st = getRunStage(week);
  switch (blockId) {
    case 'tread-intervals-10':
      return {
        id: blockId,
        title: '10-min Intervals',
        description: `Stage ${st.stage}: ${st.summary}`,
        intervals: [{ ...walkEasy, seconds: 60, label: 'Warm-up walk' }, ...stageIntervals(week, 540)],
      };
    case 'tread-steady-12': {
      const jog = st.jogging;
      return {
        id: blockId,
        title: jog ? '12-min Walk / Jog' : '12-min Brisk Walk',
        description: jog ? 'Easy walk, then a steady jog with walking breaks.' : 'Easy walk into a steady brisk walk.',
        intervals: [
          { ...walkEasy, seconds: 120, label: 'Warm-up walk' },
          ...(jog
            ? stageIntervals(week, 480)
            : [{ label: 'Brisk walk', seconds: 480, intensity: 'moderate' as const, cue: 'Steady, purposeful pace. Add 1–2% incline if easy.' }]),
          { ...walkEasy, seconds: 120, label: 'Cool-down walk' },
        ],
      };
    }
    case 'cond-warmup-5':
      return {
        id: blockId,
        title: '5-min Warm-up',
        description: 'Easy walking to loosen up.',
        intervals: [
          { ...walkEasy, seconds: 180, label: 'Easy walk' },
          { label: 'Brisk walk', seconds: 120, intensity: 'moderate', cue: 'Pick up the pace a little.' },
        ],
      };
    case 'cond-intervals-20':
      return {
        id: blockId,
        title: '20-min Intervals',
        description: `Stage ${st.stage}: ${st.summary}`,
        intervals: stageIntervals(week, 1200),
      };
    case 'cond-cooldown-5':
      return {
        id: blockId,
        title: '5-min Cool-down',
        description: 'Slow walk until your breathing settles.',
        intervals: [{ ...walkEasy, seconds: 300, label: 'Cool-down walk', cue: 'Slow down gradually. Shake out your arms.' }],
      };
    case 'tread-hard-10': {
      const hardLabel = st.jogging ? 'Fast jog' : 'Fast walk';
      const hardSecs = week <= 4 ? 30 : week <= 8 ? 45 : 60;
      const easySecs = week <= 4 ? 60 : week <= 8 ? 60 : 45;
      return {
        id: blockId,
        title: '10-min Hard Conditioning',
        description: `${hardSecs}s hard / ${easySecs}s easy`,
        intervals: [
          { ...walkEasy, seconds: 60, label: 'Warm-up walk' },
          ...fill(
            480,
            { label: 'Easy walk', seconds: easySecs, intensity: 'easy', cue: 'Recover.' },
            { label: hardLabel, seconds: hardSecs, intensity: 'hard', cue: 'Push. This should feel tough.' },
          ),
          { ...walkEasy, seconds: 60, label: 'Cool-down walk' },
        ],
      };
    }
    case 'db-circuit-10': {
      const moves = [
        { id: 'goblet-squat', label: 'Goblet squat' },
        { id: 'dumbbell-row', label: 'Dumbbell row' },
        { id: 'dumbbell-shoulder-press', label: 'Shoulder press' },
        { id: 'romanian-deadlift', label: 'Romanian deadlift' },
        { id: 'dumbbell-march', label: 'Dumbbell march' },
      ];
      const intervals: Interval[] = [];
      for (let round = 1; round <= 2; round++) {
        for (const m of moves) {
          intervals.push({ label: m.label, seconds: 40, intensity: 'hard', exerciseId: m.id, cue: `Round ${round} of 2. Light weight, steady reps.` });
          intervals.push({ label: 'Rest', seconds: 20, intensity: 'rest', cue: 'Set the dumbbells down. Breathe.' });
        }
      }
      return {
        id: blockId,
        title: 'Dumbbell Circuit',
        description: '5 moves, 40s work / 20s rest, 2 rounds. Use light dumbbells.',
        intervals,
      };
    }
    case 'optional-walk-20':
      return {
        id: blockId,
        title: 'Optional Activity',
        description: 'A 20-minute easy walk, bike, swim or anything you enjoy. Not required.',
        intervals: [{ ...walkEasy, seconds: 1200, label: 'Easy activity', cue: 'Move at a pace you enjoy.' }],
      };
    case 'cond-intervals-25':
      return {
        id: blockId,
        title: '25-min Intervals',
        description: `Stage ${st.stage}: ${st.summary}`,
        intervals: stageIntervals(week, 1500),
      };
    default:
      throw new Error(`Unknown block ${blockId}`);
  }
}

export function blockDuration(block: TimedBlock): number {
  return block.intervals.reduce((a, i) => a + i.seconds, 0);
}
