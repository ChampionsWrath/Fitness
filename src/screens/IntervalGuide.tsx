import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { ExerciseVisual } from '../components/ExerciseVisual';
import { Button, Icon } from '../components/ui';
import { getExercise } from '../data/exercises';
import { buildBlock, blockDuration } from '../data/treadmill';
import { db } from '../db/db';
import { markExerciseComplete, saveSet } from '../db/repo';
import { formatClock } from '../lib/dates';
import { newId } from '../lib/ids';
import { beep, unlockAudio, useNow, useWakeLock, vibrate } from '../lib/timer';
import { navigate } from '../hooks/useRoute';

interface GuideState {
  startedAt: number; // wall clock when the block (re)started
  offset: number; // seconds already elapsed before the last start (for pause)
  paused: boolean;
}

const KEY = (sessionId: string, idx: number) => `guide:${sessionId}:${idx}`;

/**
 * Guided interval timer for treadmill blocks and the dumbbell circuit.
 * Progress is derived from wall-clock time and persisted, so locking the
 * phone or reloading does not lose the place.
 */
export function IntervalGuide({ sessionId, index }: { sessionId: string; index: number }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const key = KEY(sessionId, index);
  const stored = useLiveQuery(async () => ((await db.meta.get(key))?.value as GuideState | undefined) ?? null, [key]);
  const [finished, setFinished] = useState(false);
  const lastIdx = useRef(-1);
  const running = !!stored && !stored.paused && !finished;
  const now = useNow(running);
  useWakeLock(running);

  const ex = session?.exercises[index];
  const block = session && ex?.blockId ? buildBlock(ex.blockId, session.week) : null;
  const total = block ? blockDuration(block) : 0;

  const elapsed = stored ? stored.offset + (stored.paused ? 0 : (now - stored.startedAt) / 1000) : 0;
  const clamped = Math.min(total, Math.max(0, elapsed));

  // locate current interval
  let acc = 0;
  let cur = 0;
  let curStart = 0;
  if (block) {
    for (let i = 0; i < block.intervals.length; i++) {
      const iv = block.intervals[i];
      if (clamped < acc + iv.seconds || i === block.intervals.length - 1) {
        cur = i;
        curStart = acc;
        break;
      }
      acc += iv.seconds;
    }
  }
  const interval = block?.intervals[cur];
  const remainingInInterval = interval ? curStart + interval.seconds - clamped : 0;
  const next = block?.intervals[cur + 1];
  const done = !!stored && total > 0 && elapsed >= total;

  useEffect(() => {
    if (!stored || finished) return;
    if (lastIdx.current !== -1 && lastIdx.current !== cur) {
      beep(2);
      vibrate([80, 40, 80]);
    }
    lastIdx.current = cur;
  }, [cur, stored, finished]);

  useEffect(() => {
    if (done && !finished) {
      setFinished(true);
      beep(4);
      vibrate([200, 80, 200, 80, 300]);
      void (async () => {
        if (!session || !ex || !block) return;
        await saveSet({
          id: newId(),
          sessionId: session.id,
          exerciseId: ex.exerciseId,
          date: session.date,
          setNumber: 1,
          weight: 0,
          reps: 0,
          duration: total,
          completed: true,
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });
        await markExerciseComplete(session.id, index, true);
        await db.meta.delete(key);
      })();
    }
  }, [done, finished, session, ex, block, key, total]);

  if (!session || !ex || !block || !interval) return null;

  const start = async () => {
    unlockAudio();
    await db.meta.put({ key, value: { startedAt: Date.now(), offset: 0, paused: false } satisfies GuideState });
  };
  const pause = async () => {
    if (!stored) return;
    await db.meta.put({ key, value: { ...stored, offset: clamped, paused: true } });
  };
  const resume = async () => {
    if (!stored) return;
    unlockAudio();
    await db.meta.put({ key, value: { ...stored, startedAt: Date.now(), paused: false } });
  };
  const skip = async () => {
    if (!stored) return;
    const nextStart = curStart + interval.seconds;
    await db.meta.put({ key, value: { startedAt: Date.now(), offset: nextStart, paused: stored.paused } });
  };
  const exit = async () => {
    await db.meta.delete(key);
    navigate(`/workout/session/${sessionId}`);
  };

  const tone = finished ? 'rest' : interval.intensity;
  const visualId = interval.exerciseId ?? ex.exerciseId;
  const figureKey = interval.exerciseId ? undefined : interval.intensity === 'hard' && ex.exerciseId.startsWith('treadmill') ? 'treadmill-jog' : interval.intensity === 'easy' && ex.exerciseId.startsWith('treadmill') ? 'treadmill-walk' : undefined;

  return (
    <div className={`interval-screen ${tone}`}>
      <div className="row between">
        <button className="icon-btn" aria-label="Back to workout" onClick={() => void exit()}>
          <Icon name="back" />
        </button>
        <div className="eyebrow">{block.title}</div>
        <div className="tiny muted num" style={{ width: 44, textAlign: 'right' }}>
          {formatClock(total - clamped)}
        </div>
      </div>

      <div className="interval-track" aria-hidden="true">
        {block.intervals.map((iv, i) => (
          <div key={i} className={`${iv.intensity} ${i < cur ? 'past' : ''} ${i === cur && stored ? 'now' : ''}`} style={{ flex: iv.seconds }} />
        ))}
      </div>

      <div className="grow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        {finished ? (
          <>
            <div className="interval-label">Done</div>
            <p className="interval-next">
              {Math.round(total / 60)} minutes complete. {block.title} saved.
            </p>
          </>
        ) : (
          <>
            <div className="eyebrow" style={{ textAlign: 'center' }}>
              Interval {cur + 1} of {block.intervals.length}
            </div>
            <div className="interval-label">{interval.label}</div>
            <div className="timer-big num">{stored ? formatClock(remainingInInterval) : formatClock(interval.seconds)}</div>
            <p className="interval-next">{interval.cue ?? ''}</p>
            <div style={{ maxWidth: 240, margin: '10px auto 0', width: '100%' }}>
              <ExerciseVisual exerciseId={visualId} figureKey={figureKey} size="lg" />
            </div>
            {next ? (
              <p className="interval-next small" style={{ marginTop: 8 }}>
                Next: {next.label} · {formatClock(next.seconds)}
              </p>
            ) : (
              <p className="interval-next small" style={{ marginTop: 8 }}>
                Last interval
              </p>
            )}
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        {finished ? (
          <Button size="lg" full onClick={() => void exit()}>
            Back to workout
          </Button>
        ) : !stored ? (
          <Button size="lg" full onClick={() => void start()}>
            <Icon name="play" size={20} /> START
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="lg" className="grow" onClick={() => void (stored.paused ? resume() : pause())}>
              <Icon name={stored.paused ? 'play' : 'pause'} size={20} /> {stored.paused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => void skip()}>
              Skip
            </Button>
          </>
        )}
      </div>
      {!stored && (
        <p className="tiny muted" style={{ textAlign: 'center', marginTop: 12 }}>
          {getExercise(ex.exerciseId).plainName} The timer keeps running if you lock your phone; sounds play while the app is open.
        </p>
      )}
    </div>
  );
}
