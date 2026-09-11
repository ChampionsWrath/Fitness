import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { ExerciseVisual } from '../components/ExerciseVisual';
import { RestTimer, startRest } from '../components/RestTimer';
import { Button, Icon, Screen, Sheet } from '../components/ui';
import { EXERCISE_MAP, getExercise } from '../data/exercises';
import { buildBlock, blockDuration } from '../data/treadmill';
import { db } from '../db/db';
import { abandonSession, finishSession, getLastSetsForExercise, markExerciseComplete, saveSet } from '../db/repo';
import { formatClock, formatDuration } from '../lib/dates';
import { getRecommendation } from '../lib/overload';
import { isTreadmill, liftingBurnForExercise, sessionBurn } from '../lib/burn';
import { useNutrition } from '../hooks/useNutrition';
import { CardioEntry } from '../components/CardioEntry';
import { sync } from '../sync/engine';
import { unlockAudio, useNow } from '../lib/timer';
import type { ExerciseSet, SessionExercise, UserProfile, WorkoutSession } from '../types';
import { navigate } from '../hooks/useRoute';
import { ExerciseDetailContent } from './ExerciseDetail';

export function ActiveWorkout({ sessionId, profile }: { sessionId: string; profile: UserProfile }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(sessionId).toArray(), [sessionId]) ?? [];
  const [detail, setDetail] = useState<SessionExercise | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [notes, setNotes] = useState('');
  const { weightKg } = useNutrition(profile);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const now = useNow(!!session && session.status === 'in-progress', 1000);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!session) return;
    if (session.status !== 'in-progress') navigate(`/progress/history/${session.id}`);
  }, [session]);

  if (session === undefined) return <Screen noNav>{null}</Screen>;
  if (!session)
    return (
      <Screen title="Workout not found" onBack={() => navigate('/workout')} noNav>
        <div className="notice">This session no longer exists.</div>
      </Screen>
    );

  const burn = sessionBurn(session, sets, weightKg);
  const firstIncomplete = session.exercises.findIndex((e) => !e.completed);
  const current = activeIdx ?? (firstIncomplete === -1 ? null : firstIncomplete);
  const completedCount = session.exercises.filter((e) => e.completed).length;
  const doneSets = sets.filter((s) => s.completed).length;

  const focus = (i: number) => {
    setActiveIdx(i);
    setDetail(null);
    setTimeout(() => cardRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const finish = async () => {
    await finishSession(session.id, notes.trim() || undefined, burn);
    // make sure the finished workout reaches the cloud backup before leaving
    await Promise.race([sync.flush(true), new Promise((r) => setTimeout(r, 4000))]);
    navigate(`/progress/history/${session.id}`);
  };

  return (
    <>
      <Screen
        eyebrow={`${formatClock((now - session.startTime) / 1000)} elapsed · ${doneSets} sets`}
        title={session.title}
        onBack={() => navigate('/workout')}
        noNav
        right={
          <Button variant="secondary" size="sm" onClick={() => setFinishing(true)}>
            Finish
          </Button>
        }
      >
        <div className="progress" style={{ marginBottom: 16 }}>
          <div style={{ width: `${(completedCount / Math.max(1, session.exercises.length)) * 100}%` }} />
        </div>
        <div className="stack">
          {session.exercises.map((ex, i) => (
            <div key={`${ex.exerciseId}-${i}`} ref={(el) => {
              cardRefs.current[i] = el;
            }} style={{ scrollMarginTop: 12 }}>
              {ex.prescription ? (
                <StrengthCard
                  session={session}
                  ex={ex}
                  index={i}
                  sets={sets.filter((s) => s.exerciseId === ex.exerciseId).sort((a, b) => a.setNumber - b.setNumber)}
                  profile={profile}
                  active={current === i}
                  onOpen={() => setDetail(ex)}
                  onFocus={() => setActiveIdx(i)}
                  weightKg={weightKg}
                />
              ) : (
                <TimedCard session={session} ex={ex} index={i} active={current === i} onOpen={() => setDetail(ex)} units={profile.units} weightKg={weightKg} kcal={burn.perExercise[i]} />
              )}
            </div>
          ))}
          <Button size="lg" full variant={firstIncomplete === -1 ? 'primary' : 'secondary'} onClick={() => setFinishing(true)}>
            FINISH WORKOUT
          </Button>
          <Button
            variant="danger"
            full
            onClick={async () => {
              if (confirm('Discard this workout? Nothing will be saved.')) {
                await abandonSession(session.id);
                navigate('/workout');
              }
            }}
          >
            Discard workout
          </Button>
        </div>
      </Screen>

      <Sheet open={!!detail} onClose={() => setDetail(null)} full>
        {detail && (
          <ExerciseDetailContent
            exerciseId={detail.exerciseId}
            units={profile.units}
            substitutedFor={detail.substitutedFor}
            onStart={() => focus(session.exercises.indexOf(detail))}
          />
        )}
      </Sheet>

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Finish workout">
        <div className="stack">
          <div className="stat-grid three">
            <div className="stat">
              <div className="label">Time</div>
              <div className="value">{formatDuration(now - session.startTime)}</div>
            </div>
            <div className="stat">
              <div className="label">Exercises</div>
              <div className="value">
                {completedCount}
                <small>/ {session.exercises.length}</small>
              </div>
            </div>
            <div className="stat">
              <div className="label">Sets</div>
              <div className="value">{doneSets}</div>
            </div>
          </div>
          {firstIncomplete !== -1 && <div className="notice">Some exercises aren’t marked complete. Only completed sets are saved to your history.</div>}
          <div className="burn-summary">
            <div>
              <span className="lbl">Lifting</span>
              <b className="num">{burn.lifting}</b>
            </div>
            <div>
              <span className="lbl">Treadmill / circuit</span>
              <b className="num">{burn.cardio}</b>
            </div>
            <div className="total">
              <span className="lbl">Burned</span>
              <b className="num">{burn.total} kcal</b>
            </div>
          </div>
          {burn.missingReadout.length > 0 && <div className="notice warn">Treadmill block has no distance entered, so its calories are a rough guess from the intervals. Enter the readout on the treadmill card (you can also do it later from History).</div>}
          {burn.total === 0 && <div className="notice">Complete a set or a treadmill block to earn calorie credit.</div>}
          <textarea className="input" placeholder="Notes (optional): how did it feel?" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button size="lg" full onClick={() => void finish()}>
            Save workout
          </Button>
        </div>
      </Sheet>
      <RestTimer />
    </>
  );
}

function StrengthCard({
  session,
  ex,
  index,
  sets,
  profile,
  active,
  onOpen,
  onFocus,
  weightKg,
}: {
  session: WorkoutSession;
  ex: SessionExercise;
  index: number;
  sets: ExerciseSet[];
  profile: UserProfile;
  active: boolean;
  onOpen: () => void;
  onFocus: () => void;
  weightKg: number;
}) {
  const exercise = getExercise(ex.exerciseId);
  const rx = ex.prescription!;
  const kcal = Math.round(liftingBurnForExercise(exercise, sets, weightKg));
  const last = useLiveQuery(() => getLastSetsForExercise(ex.exerciseId, session.id), [ex.exerciseId, session.id]) ?? [];
  const reco = getRecommendation(exercise, rx, last, profile.units);
  const [drafts, setDrafts] = useState<Record<string, { weight: string; reps: string }>>({});
  const bodyweight = exercise.defaultWeightLb === 0;

  const draft = (s: ExerciseSet) => drafts[s.id] ?? { weight: s.weight ? String(s.weight) : '', reps: String(s.reps) };
  const setDraft = (s: ExerciseSet, patch: Partial<{ weight: string; reps: string }>) => setDrafts((d) => ({ ...d, [s.id]: { ...draft(s), ...patch } }));

  const commit = async (s: ExerciseSet, completed?: boolean) => {
    const d = draft(s);
    const weight = Math.max(0, Number(d.weight) || 0);
    const reps = Math.max(0, Math.round(Number(d.reps) || 0));
    const next: ExerciseSet = { ...s, weight, reps, completed: completed ?? s.completed, completedAt: completed ? Date.now() : s.completedAt };
    await saveSet(next);
    if (completed) {
      // copy weight/reps forward to the next incomplete set so the user doesn't retype
      const following = sets.filter((x) => x.setNumber > s.setNumber && !x.completed);
      for (const f of following) {
        if (!drafts[f.id]) await saveSet({ ...f, weight, reps: f.reps || reps });
      }
      const allDone = sets.every((x) => x.id === s.id || x.completed);
      if (allDone) {
        await markExerciseComplete(session.id, index, true);
      } else {
        await startRest(exercise.restSeconds || profile.defaultRestSeconds, `${exercise.name} · set ${s.setNumber + 1}`);
      }
    } else if (completed === false) {
      await markExerciseComplete(session.id, index, false);
    }
  };

  const repsLabel = rx.repMin === rx.repMax ? `${rx.repMin}` : `${rx.repMin}–${rx.repMax}`;

  return (
    <div className={`ex-card ${active ? 'active' : ''} ${ex.completed ? 'done' : ''}`} onFocusCapture={onFocus}>
      <button className="head" onClick={onOpen} aria-label={`How to do ${exercise.name}`}>
        <ExerciseVisual exerciseId={ex.exerciseId} size="md" />
        <div className="grow">
          <div className="eyebrow">Exercise {index + 1}</div>
          <div className="name">{exercise.name}</div>
          <div className="meta">
            {rx.sets} sets × {repsLabel} reps{rx.perSide ? ' each side' : ''}
            {ex.substitutedFor && ` · replaces ${EXERCISE_MAP[ex.substitutedFor]?.name}`}
            {kcal > 0 && <span className="num"> · ≈ {kcal} kcal</span>}
          </div>
          <div className="meta" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            <Icon name="info" /> How to do it
          </div>
        </div>
      </button>
      <div className="body">
        {reco && <div className={`reco ${reco.kind === 'increase' ? '' : 'hold'}`}>{reco.message}</div>}
        {last.length > 0 ? (
          <div className="prev">
            Last time: <b className="num">{last.map((s) => (s.weight > 0 ? `${s.weight} × ${s.reps}` : `${s.reps} reps`)).join('  ·  ')}</b>
          </div>
        ) : (
          <div className="prev">
            First time. Start with <b>{exercise.beginnerWeight}</b> and focus on form.
          </div>
        )}
        <div className="set-head">
          <span>Set</span>
          <span>{bodyweight ? 'Added weight' : 'Weight'}</span>
          <span>Reps</span>
          <span />
        </div>
        {sets.map((s) => {
          const d = draft(s);
          return (
            <div key={s.id} className={`set-row ${s.completed ? 'done' : ''}`}>
              <span className="n num">{s.setNumber}</span>
              <label className="num-in">
                <input
                  type="number"
                  inputMode="decimal"
                  step={profile.units === 'kg' ? 0.5 : 2.5}
                  min={0}
                  value={d.weight}
                  placeholder="0"
                  aria-label={`Set ${s.setNumber} weight`}
                  onChange={(e) => setDraft(s, { weight: e.target.value })}
                  onBlur={() => void commit(s)}
                  onFocus={unlockAudio}
                />
                <span>{profile.units}</span>
              </label>
              <label className="num-in">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={d.reps}
                  aria-label={`Set ${s.setNumber} reps`}
                  onChange={(e) => setDraft(s, { reps: e.target.value })}
                  onBlur={() => void commit(s)}
                  onFocus={unlockAudio}
                />
                <span>reps</span>
              </label>
              <button
                className={`done-btn ${s.completed ? 'on' : ''}`}
                aria-label={s.completed ? `Set ${s.setNumber} complete. Tap to undo` : `Complete set ${s.setNumber}`}
                aria-pressed={s.completed}
                onClick={() => {
                  unlockAudio();
                  void commit(s, !s.completed);
                }}
              >
                <Icon name="check" size={22} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimedCard({
  session,
  ex,
  index,
  active,
  onOpen,
  units,
  weightKg,
  kcal,
}: {
  session: WorkoutSession;
  ex: SessionExercise;
  index: number;
  active: boolean;
  onOpen: () => void;
  units: UserProfile['units'];
  weightKg: number;
  kcal: number;
}) {
  const exercise = getExercise(ex.exerciseId);
  const block = buildBlock(ex.blockId!, session.week);
  const mins = Math.round(blockDuration(block) / 60);
  return (
    <div className={`ex-card ${active ? 'active' : ''} ${ex.completed ? 'done' : ''}`}>
      <button className="head" onClick={onOpen} aria-label={`How to do ${exercise.name}`}>
        <ExerciseVisual exerciseId={ex.exerciseId} size="md" />
        <div className="grow">
          <div className="eyebrow">Exercise {index + 1}</div>
          <div className="name">{block.title}</div>
          <div className="meta">
            {mins} min · {block.description}
            {kcal > 0 && <span className="num"> · ≈ {kcal} kcal</span>}
          </div>
          <div className="meta" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            <Icon name="info" /> How to do it
          </div>
        </div>
      </button>
      {isTreadmill(ex.exerciseId) && (
        <div className="body" style={{ paddingBottom: 8 }}>
          <CardioEntry session={session} index={index} ex={ex} units={units} weightKg={weightKg} defaultMinutes={mins} />
        </div>
      )}
      <div className="body row">
        <Button className="grow" variant={ex.completed ? 'secondary' : 'primary'} onClick={() => navigate(`/workout/session/${session.id}/block/${index}`)}>
          <Icon name="play" size={18} /> {ex.completed ? 'Run again' : 'Start guided timer'}
        </Button>
        <button
          className={`done-btn set-row ${ex.completed ? 'on' : ''}`}
          style={{ width: 56, height: 48, borderRadius: 12, background: ex.completed ? 'var(--good)' : 'var(--surface-2)', color: ex.completed ? '#0b1a12' : 'var(--text-3)', display: 'grid', placeItems: 'center' }}
          aria-label={ex.completed ? 'Mark not done' : 'Mark done without timer'}
          onClick={() => void markExerciseComplete(session.id, index, !ex.completed)}
        >
          <Icon name="check" size={22} />
        </button>
      </div>
    </div>
  );
}
