import { useLiveQuery } from 'dexie-react-hooks';
import { BottomNav } from '../components/BottomNav';
import { ExerciseVisual } from '../components/ExerciseVisual';
import { Button, Icon, Screen } from '../components/ui';
import { EXERCISE_MAP } from '../data/exercises';
import { PHASES, getPlan } from '../data/program';
import { buildBlock, blockDuration, getRunStage, RUN_STAGES } from '../data/treadmill';
import { db } from '../db/db';
import { buildSessionExercises, getActiveSession, startSession } from '../db/repo';
import { WEEKDAY_SHORT, formatDate, todayISO, weekdayOf } from '../lib/dates';
import { planForDate, programPosition, weekSchedule } from '../lib/schedule';
import { navigate } from '../hooks/useRoute';
import type { UserProfile, WorkoutPlan } from '../types';

function prescriptionLabel(item: WorkoutPlan['items'][number], week: number): string {
  if (item.type === 'strength') {
    const p = item.prescription;
    const reps = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`;
    return `${p.sets} × ${reps}${p.perSide ? ' each side' : ''}`;
  }
  const b = buildBlock(item.blockId, week);
  return `${Math.round(blockDuration(b) / 60)} min · ${b.title}`;
}

export function WorkoutTab({ profile, date }: { profile: UserProfile; date?: string }) {
  const today = todayISO();
  const target = date ?? today;
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('completed').toArray(), []) ?? [];
  const active = useLiveQuery(getActiveSession, []);
  const pos = programPosition(profile.programStartDate, target);
  const plan = planForDate(profile, target);
  const week = weekSchedule(profile, target);
  const doneDates = new Set(sessions.map((s) => s.date));
  const resolved = buildSessionExercises(plan, profile.equipment);
  const stage = getRunStage(pos.week);
  const isToday = target === today;

  const start = async () => {
    if (active) return navigate(`/workout/session/${active.id}`);
    const s = await startSession(plan, profile, isToday ? today : today);
    navigate(`/workout/session/${s.id}`);
  };

  return (
    <>
      <Screen title="Workout" eyebrow={`Phase ${pos.phase.id} · ${pos.phase.name} · Week ${pos.week}`}>
        <div className="stack">
          {active && (
            <button className="card tappable row" onClick={() => navigate(`/workout/session/${active.id}`)} style={{ textAlign: 'left', width: '100%' }}>
              <div className="grow">
                <div className="eyebrow" style={{ color: 'var(--accent)' }}>
                  In progress
                </div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{active.title}</div>
                <div className="small muted">Started {new Date(active.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
              </div>
              <Icon name="chev" />
            </button>
          )}

          <div className="week-strip" role="tablist" aria-label="This week">
            {week.map((d) => {
              const rest = d.plan.type === 'rest' || d.plan.type === 'optional';
              return (
                <a
                  key={d.date}
                  href={`#/workout/day/${d.date}`}
                  className={`day ${d.date === today ? 'today' : ''} ${doneDates.has(d.date) ? 'done' : ''} ${rest ? 'rest' : ''}`}
                  style={d.date === target ? { background: 'var(--surface-3)' } : undefined}
                  aria-current={d.date === target ? 'true' : undefined}
                >
                  {WEEKDAY_SHORT[weekdayOf(d.date)]}
                  <span className="d num">{doneDates.has(d.date) ? '✓' : Number(d.date.slice(-2))}</span>
                </a>
              );
            })}
          </div>

          <div>
            <div className="eyebrow">{isToday ? 'Today' : formatDate(target, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>{plan.title}</h2>
            <p className="muted small">
              {plan.subtitle}
              {plan.estimatedMinutes ? ` · about ${plan.estimatedMinutes} min` : ''}
            </p>
          </div>

          {plan.type === 'rest' ? (
            <div className="card flat">
              <b>Rest day.</b>
              <p className="small muted" style={{ marginTop: 4 }}>
                Muscles grow between workouts. A short walk and a good night’s sleep are the work today. If you missed a session this week, pick any day above to do it instead.
              </p>
            </div>
          ) : (
            <div className="list">
              {resolved.map((ex, i) => {
                const e = EXERCISE_MAP[ex.exerciseId];
                const item = plan.items[i];
                const timed = item.type === 'timed';
                const title = timed ? buildBlock(item.blockId, pos.week).title : e.name;
                return (
                  <a key={i} href={`#/exercises/${ex.exerciseId}`} className="list-item">
                    <ExerciseVisual exerciseId={ex.exerciseId} size="sm" />
                    <div className="grow">
                      <div className="title">{title}</div>
                      <div className="sub">
                        {prescriptionLabel(item, pos.week)}
                        {ex.substitutedFor && ` · replaces ${EXERCISE_MAP[ex.substitutedFor]?.name}`}
                      </div>
                    </div>
                    <span className="chev">
                      <Icon name="chev" />
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          {plan.type !== 'rest' && (
            <div className="sticky-bottom">
              <Button size="lg" full onClick={() => void start()}>
                {active ? 'RESUME WORKOUT' : doneDates.has(target) && isToday ? 'START AGAIN' : plan.type === 'optional' ? 'START OPTIONAL ACTIVITY' : isToday ? 'START WORKOUT' : 'DO THIS WORKOUT TODAY'}
              </Button>
            </div>
          )}

          <div className="section">
            <div className="section-title">
              <h2>5K progression</h2>
              <span className="pill accent">Stage {stage.stage} of 8</span>
            </div>
            <div className="card">
              <div style={{ fontWeight: 800, fontSize: 18 }}>{stage.title}</div>
              <div className="small muted">{stage.summary}</div>
              <div className="interval-track" style={{ margin: '14px 0 6px' }}>
                {RUN_STAGES.map((s) => (
                  <div key={s.stage} className={s.stage < stage.stage ? 'hard past' : s.stage === stage.stage ? 'hard now' : ''} />
                ))}
              </div>
              <p className="tiny muted">
                Intervals get longer every two weeks. By week 12 you’ll jog for eight minutes at a time; by month 4 you run continuously.
              </p>
            </div>
          </div>

          <div className="section">
            <div className="section-title">
              <h2>Program</h2>
            </div>
            <div className="list">
              {PHASES.map((ph) => (
                <div key={ph.id} className="list-item" style={{ opacity: ph.id === pos.phase.id ? 1 : 0.7 }}>
                  <div className="grow">
                    <div className="title">
                      Phase {ph.id} · {ph.name}{' '}
                      {ph.id === pos.phase.id && <span className="pill accent">current</span>}
                    </div>
                    <div className="sub">
                      {ph.monthsLabel} · {ph.description}
                    </div>
                    <div className="sub" style={{ marginTop: 4 }}>
                      {Object.entries(ph.schedule)
                        .sort((a, b) => ((Number(a[0]) + 6) % 7) - ((Number(b[0]) + 6) % 7))
                        .map(([d, id]) => `${WEEKDAY_SHORT[Number(d)]}: ${getPlan(id).title}`)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Screen>
      <BottomNav active="workout" />
    </>
  );
}
