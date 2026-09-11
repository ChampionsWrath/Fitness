import { useLiveQuery } from 'dexie-react-hooks';
import { BottomNav } from '../components/BottomNav';
import { ExerciseVisual } from '../components/ExerciseVisual';
import { Button, Icon, ProgressBar, Screen, Stat } from '../components/ui';
import { db } from '../db/db';
import { getActiveSession, listWaists, listWeights, startSession } from '../db/repo';
import { formatDate, todayISO } from '../lib/dates';
import { currentStreak, missedYesterday, monthlyCount, planForDate, programPosition, weeklyCompletion } from '../lib/schedule';
import { summarizeWeights } from '../lib/stats';
import { fmt, waistUnit } from '../lib/units';
import { PROGRAM_WEEKS } from '../data/program';
import { getExercise } from '../data/exercises';
import { buildBlock } from '../data/treadmill';
import type { UserProfile } from '../types';
import { navigate } from '../hooks/useRoute';
import { useNutrition, useWorkoutsBetween, workoutBurn } from '../hooks/useNutrition';
import { useSyncStatus } from '../hooks/useSync';
import { getSteps, listFoodEntries } from '../db/repo';
import { sumEntries } from '../lib/nutrition';

export function Home({ profile }: { profile: UserProfile }) {
  const today = todayISO();
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('completed').toArray(), []) ?? [];
  const weights = useLiveQuery(listWeights, []) ?? [];
  const waists = useLiveQuery(listWaists, []) ?? [];
  const active = useLiveQuery(getActiveSession, []);
  const { targets, bonusFor } = useNutrition(profile);
  const syncStatus = useSyncStatus();
  const foodToday = useLiveQuery(() => listFoodEntries(today), [today]) ?? [];
  const stepsToday = useLiveQuery(() => getSteps(today), [today]);
  const eaten = sumEntries(foodToday);
  const todaysWorkouts = useWorkoutsBetween(today, today);
  const burnedToday = bonusFor(stepsToday?.steps) + workoutBurn(todaysWorkouts, today);
  const netToday = eaten.kcal - burnedToday;
  const dayTarget = targets ? targets.kcal : 0;
  const pos = programPosition(profile.programStartDate, today);
  const plan = planForDate(profile, today);
  const summary = summarizeWeights(weights.map((w) => ({ date: w.date, value: w.weight })), profile.startWeight);
  const waist = waists.length ? waists[waists.length - 1].waist : profile.startWaist;
  const streak = currentStreak(profile, sessions, today);
  const missed = missedYesterday(profile, sessions, today);
  const week = weeklyCompletion(profile, sessions, today);
  const month = monthlyCount(sessions, today);
  const doneToday = sessions.some((s) => s.date === today);
  const isRest = plan.type === 'rest';

  const start = async () => {
    if (active) return navigate(`/workout/session/${active.id}`);
    const s = await startSession(plan, profile);
    navigate(`/workout/session/${s.id}`);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();

  return (
    <>
      <Screen
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        title={profile.name ? `${greeting}, ${profile.name}` : greeting}
        right={
          <a href="#/settings" className="icon-btn" aria-label="Settings">
            <Icon name="settings" />
          </a>
        }
      >
        <div className="stack">
          <a href="#/settings" className={`backup-line ${syncStatus.state === 'ready' && syncStatus.verified ? 'ok' : syncStatus.state === 'checking' || syncStatus.state === 'syncing' ? '' : 'bad'}`}>
            {syncStatus.state === 'checking' && 'Backup: checking…'}
            {syncStatus.state === 'syncing' && 'Backup: saving…'}
            {syncStatus.state === 'ready' && syncStatus.verified && `Backup on · ${syncStatus.lastPush ? `saved ${new Date(syncStatus.lastPush).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'write verified'}`}
            {syncStatus.state === 'ready' && !syncStatus.verified && 'Backup: connected, no write confirmed yet'}
            {syncStatus.state === 'error' && `Backup FAILED: ${syncStatus.error ?? 'unknown error'} · tap for manual backup`}
            {syncStatus.state === 'off' && `Backup OFF: ${syncStatus.reason ?? 'no cloud store'} · tap for manual backup`}
          </a>
          <div className="hero">
            <div className="eyebrow">18-month transformation</div>
            <div className="row between" style={{ margin: '8px 0 12px', alignItems: 'flex-end' }}>
              <div className="week">
                Week {pos.week} <small>of {PROGRAM_WEEKS}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 18 }} className="num">
                  {pos.daysRemaining}
                </div>
                <div className="tiny muted">days remaining</div>
              </div>
            </div>
            <ProgressBar value={pos.progress} />
            <div className="row between" style={{ marginTop: 10 }}>
              <span className="pill accent">
                Phase {pos.phase.id} · {pos.phase.name}
              </span>
              <span className="tiny muted">
                {pos.phase.monthsLabel} · week {pos.weekOfPhase} of phase
              </span>
            </div>
          </div>

          {missed && !doneToday && !isRest && <div className="notice warn">Missed yesterday. Get back on track today.</div>}

          <div className="today-card">
            <div className="eyebrow">{doneToday ? 'Completed today' : active ? 'Workout in progress' : "Today's workout"}</div>
            <h2>{active ? active.title : plan.title}</h2>
            <div className="sub">{isRest ? 'Recovery day. Walk, stretch, sleep well.' : `${plan.subtitle} · about ${plan.estimatedMinutes} min`}</div>
            {!isRest && (
              <div className="row" style={{ marginTop: 14, gap: 8, overflowX: 'auto' }}>
                {plan.items.slice(0, 6).map((it, i) => (
                  <ExerciseVisual key={i} exerciseId={it.exerciseId} size="sm" />
                ))}
              </div>
            )}
            {!isRest && (
              <Button size="lg" full onClick={() => void start()}>
                {active ? 'RESUME WORKOUT' : doneToday ? 'START ANOTHER SESSION' : "START TODAY'S WORKOUT"}
              </Button>
            )}
            {isRest && (
              <Button size="lg" full variant="secondary" style={{ marginTop: 16 }} onClick={() => navigate('/workout')}>
                See this week
              </Button>
            )}
          </div>

          <div className="stat-grid">
            <Stat label="Current weight" value={fmt(summary.current ?? profile.startWeight)} unit={profile.units} sub={summary.currentDate ? `Logged ${formatDate(summary.currentDate)}` : 'From onboarding'} />
            <Stat label="Starting weight" value={fmt(profile.startWeight)} unit={profile.units} sub={`Goal ${fmt(profile.goalWeight)} ${profile.units}`} />
            <Stat label="Weight lost" value={fmt(summary.totalLost ?? 0)} unit={profile.units} tone={summary.totalLost && summary.totalLost > 0 ? 'good' : undefined} sub={summary.trend ? `Trend ${fmt(summary.trend)} ${profile.units}` : 'Log weight to track'} />
            <Stat label="Waist" value={waist != null ? fmt(waist) : '—'} unit={waist != null ? waistUnit(profile.units) : undefined} sub={waists.length ? `Logged ${formatDate(waists[waists.length - 1].date)}` : 'Optional'} />
          </div>

          <div className="stat-grid three">
            <Stat label="Streak" value={streak} unit={streak === 1 ? 'day' : 'days'} />
            <Stat label="This week" value={`${Math.round(week.pct * 100)}%`} sub={`${week.done} of ${week.scheduled}`} />
            <Stat label="This month" value={month} unit={month === 1 ? 'workout' : 'workouts'} />
          </div>

          {plan.items.some((i) => i.type === 'timed' && i.exerciseId.startsWith('treadmill')) && (
            <div className="card flat row">
              <div className="grow">
                <div className="eyebrow">5K progression</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>{buildBlock('tread-intervals-10', pos.week).description}</div>
              </div>
              <ExerciseVisual exerciseId="treadmill-intervals" size="sm" />
            </div>
          )}

          <button className="card tappable" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('/food')}>
            <div className="row between">
              <div className="grow">
                <div className="eyebrow">Food today</div>
                {targets ? (
                  <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }} className="num">
                    {netToday.toLocaleString()} <span className="muted" style={{ fontWeight: 600, fontSize: 14 }}>net of {dayTarget.toLocaleString()} kcal</span>
                  </div>
                ) : (
                  <div style={{ fontWeight: 700 }}>Set up calorie & protein targets</div>
                )}
                {targets && (
                  <div className="tiny muted">
                    Ate {eaten.kcal.toLocaleString()} · burned {burnedToday.toLocaleString()} · protein {Math.round(eaten.protein)}/{targets.protein}g · {Math.max(0, dayTarget - netToday).toLocaleString()} left
                    {stepsToday ? ` · ${stepsToday.steps.toLocaleString()} steps` : ' · no steps yet'}
                  </div>
                )}
              </div>
              <span className="btn secondary sm">Log food</span>
            </div>
            {targets && (
              <div className="progress" style={{ marginTop: 10, height: 6 }}>
                <div style={{ width: `${Math.min(100, (Math.max(0, netToday) / dayTarget) * 100)}%` }} />
              </div>
            )}
          </button>

          <div className="row">
            <Button variant="secondary" className="grow" onClick={() => navigate('/progress/weight')}>
              Log weight
            </Button>
            <Button variant="secondary" className="grow" onClick={() => navigate(`/exercises/${plan.items[0] ? getExercise(plan.items[0].exerciseId).id : 'goblet-squat'}`)}>
              Learn a move
            </Button>
          </div>
        </div>
      </Screen>
      <BottomNav active="home" />
    </>
  );
}
