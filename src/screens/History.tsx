import { useLiveQuery } from 'dexie-react-hooks';
import { BottomNav } from '../components/BottomNav';
import { ExerciseVisual } from '../components/ExerciseVisual';
import { Button, Icon, Screen, Stat } from '../components/ui';
import { EXERCISE_MAP } from '../data/exercises';
import { blockDuration, buildBlock } from '../data/treadmill';

function blockDurationMinutes(blockId: string, week: number): number {
  return blockDuration(buildBlock(blockId, week)) / 60;
}
import { db } from '../db/db';
import { deleteSession, getSetsForSession, listCompletedSessions } from '../db/repo';
import { formatDate, formatDateLong, formatDuration, formatClock } from '../lib/dates';
import { CardioEntry } from '../components/CardioEntry';
import { useNutrition } from '../hooks/useNutrition';
import { isTreadmill, sessionBurn } from '../lib/burn';
import type { UserProfile, WorkoutSession } from '../types';

function describeWeights(sets: { exerciseId: string; weight: number; completed: boolean }[]): string {
  const byEx = new Map<string, Set<number>>();
  for (const s of sets) {
    if (!s.completed || s.weight <= 0) continue;
    byEx.set(s.exerciseId, (byEx.get(s.exerciseId) ?? new Set()).add(s.weight));
  }
  return [...byEx.entries()]
    .map(([id, ws]) => `${EXERCISE_MAP[id]?.name.split(' ').slice(-2).join(' ') ?? id} ${[...ws].join('/')}`)
    .slice(0, 4)
    .join(' · ');
}

export function History({ profile, onBack }: { profile: UserProfile; onBack: () => void }) {
  const sessions = useLiveQuery(listCompletedSessions, []) ?? [];
  const allSets = useLiveQuery(() => db.sets.filter((s) => s.completed).toArray(), []) ?? [];

  return (
    <>
      <Screen title="History" onBack={onBack}>
        {sessions.length ? (
          <div className="list">
            {sessions.map((s) => {
              const sets = allSets.filter((x) => x.sessionId === s.id);
              return (
                <a key={s.id} href={`#/progress/history/${s.id}`} className="list-item">
                  <div className="grow">
                    <div className="tiny muted">{formatDateLong(s.date)}</div>
                    <div className="title">{s.title}</div>
                    <div className="sub">
                      {s.endTime ? formatDuration(s.endTime - s.startTime) : '—'} · {s.completedExercises.length}/{s.exercises.length} exercises · {sets.filter((x) => !x.duration).length} sets
                      {s.caloriesBurned ? ` · ≈${s.caloriesBurned} kcal${s.burnLifting != null ? ` (lift ${s.burnLifting} · cardio ${s.burnCardio ?? 0})` : ''}` : ''}
                    </div>
                    {describeWeights(sets) && (
                      <div className="sub num">
                        {describeWeights(sets)} {profile.units}
                      </div>
                    )}
                  </div>
                  <span className="chev">
                    <Icon name="chev" />
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="notice">No completed workouts yet. Your first one will show up here.</div>
        )}
      </Screen>
      <BottomNav active="progress" />
    </>
  );
}

export function SessionDetail({ id, profile, onBack, justFinished }: { id: string; profile: UserProfile; onBack: () => void; justFinished?: boolean }) {
  const session = useLiveQuery(() => db.sessions.get(id), [id]);
  const sets = useLiveQuery(() => getSetsForSession(id), [id]) ?? [];
  const { weightKg } = useNutrition(profile);
  if (session === undefined) return <Screen onBack={onBack}>{null}</Screen>;
  if (!session)
    return (
      <Screen title="Not found" onBack={onBack}>
        <div className="notice">This workout was deleted.</div>
      </Screen>
    );
  const strengthSets = sets.filter((s) => s.completed && !s.duration);
  const volume = strengthSets.reduce((a, s) => a + s.weight * s.reps, 0);
  const burn = sessionBurn(session, sets, weightKg);
  return (
    <>
      <Screen eyebrow={formatDateLong(session.date)} title={justFinished ? 'Workout saved' : session.title} onBack={onBack}>
        <div className="stack">
          {justFinished && <div className="notice">{session.title} is in the books. {session.week <= 2 ? 'The first weeks are about showing up. You did.' : 'Consistency is the whole game.'}</div>}
          <div className="stat-grid three">
            <Stat label="Duration" value={session.endTime ? formatDuration(session.endTime - session.startTime) : '—'} />
            <Stat label="Exercises" value={`${session.completedExercises.length}/${session.exercises.length}`} />
            <Stat label="Sets" value={strengthSets.length} sub={volume ? `${Math.round(volume).toLocaleString()} ${profile.units} moved` : undefined} />
          </div>
          {session.caloriesBurned != null && (
            <div className="notice">
              ≈ <b>{session.caloriesBurned} kcal burned</b>: lifting {session.burnLifting ?? 0} · treadmill/circuit {session.burnCardio ?? 0}. Credited against your food for {formatDate(session.date)}.
              {burn.missingReadout.length > 0 && ' Enter the treadmill readout below for a better estimate.'}
            </div>
          )}
          <div className="list">
            {session.exercises.map((ex, i) => {
              const e = EXERCISE_MAP[ex.exerciseId];
              const exSets = sets.filter((s) => s.exerciseId === ex.exerciseId && s.completed).sort((a, b) => a.setNumber - b.setNumber);
              const title = ex.blockId ? buildBlock(ex.blockId, session.week).title : e?.name;
              return (
                <div key={i} className="list-item" style={{ alignItems: 'flex-start', opacity: ex.completed ? 1 : 0.55 }}>
                  <ExerciseVisual exerciseId={ex.exerciseId} size="sm" />
                  <div className="grow">
                    <div className="title">{title}</div>
                    {ex.blockId ? (
                      <div className="sub">
                        {ex.completed ? `Completed${exSets[0]?.duration ? ` · ${formatClock(exSets[0].duration)}` : ''}` : 'Not completed'}
                        {burn.perExercise[i] > 0 && ` · ≈ ${burn.perExercise[i]} kcal`}
                      </div>
                    ) : exSets.length ? (
                      <div className="sub num">
                        {exSets.map((s) => (s.weight > 0 ? `${s.weight} × ${s.reps}` : `${s.reps} reps`)).join('  ·  ')}
                        {burn.perExercise[i] > 0 && `  ·  ≈ ${burn.perExercise[i]} kcal`}
                      </div>
                    ) : (
                      <div className="sub">No sets completed</div>
                    )}
                    {ex.blockId && isTreadmill(ex.exerciseId) && (
                      <div style={{ marginTop: 8 }}>
                        <CardioEntry session={session} index={i} ex={ex} units={profile.units} weightKg={weightKg} defaultMinutes={Math.round(blockDurationMinutes(ex.blockId, session.week))} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {session.notes && (
            <div className="card flat">
              <div className="eyebrow">Notes</div>
              <p style={{ marginTop: 4 }}>{session.notes}</p>
            </div>
          )}
          {justFinished ? (
            <Button size="lg" full onClick={() => (window.location.hash = '#/home')}>
              Done
            </Button>
          ) : (
            <Button
              variant="danger"
              full
              onClick={async () => {
                if (confirm('Delete this workout from history?')) {
                  await deleteSession(session.id);
                  onBack();
                }
              }}
            >
              Delete workout
            </Button>
          )}
        </div>
      </Screen>
      <BottomNav active="progress" />
    </>
  );
}

export type { WorkoutSession };
