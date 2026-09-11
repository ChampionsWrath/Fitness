import { useLiveQuery } from 'dexie-react-hooks';
import { BottomNav } from '../components/BottomNav';
import { LineChart } from '../components/LineChart';
import { Button, Icon, ProgressBar, Screen, Stat } from '../components/ui';
import { EXERCISE_MAP } from '../data/exercises';
import { getRunStage, runProgress } from '../data/treadmill';
import { db } from '../db/db';
import { getAllCompletedSets, listWaists, listWeights } from '../db/repo';
import { formatDate, todayISO } from '../lib/dates';
import { computePRs } from '../lib/overload';
import { currentStreak, monthlyCount, programPosition, weeklyCompletion } from '../lib/schedule';
import { movingAverage, summarizeWeights } from '../lib/stats';
import { fmt, signed, waistUnit } from '../lib/units';
import type { UserProfile } from '../types';

export function ProgressTab({ profile }: { profile: UserProfile }) {
  const today = todayISO();
  const weights = useLiveQuery(listWeights, []) ?? [];
  const waists = useLiveQuery(listWaists, []) ?? [];
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('completed').toArray(), []) ?? [];
  const allSets = useLiveQuery(getAllCompletedSets, []) ?? [];
  const pos = programPosition(profile.programStartDate, today);
  const wPts = weights.map((w) => ({ date: w.date, value: w.weight }));
  const summary = summarizeWeights(wPts, profile.startWeight);
  const streak = currentStreak(profile, sessions, today);
  const week = weeklyCompletion(profile, sessions, today);
  const month = monthlyCount(sessions, today);
  const prs = Object.values(computePRs(allSets)).sort((a, b) => b.date.localeCompare(a.date));
  const stage = getRunStage(pos.week);
  const toGoal = summary.current != null ? summary.current - profile.goalWeight : null;

  return (
    <>
      <Screen title="Progress">
        <div className="stack">
          <div className="stat-grid">
            <Stat label="Current" value={fmt(summary.current ?? profile.startWeight)} unit={profile.units} sub={summary.trend ? `7-day trend ${fmt(summary.trend)}` : undefined} />
            <Stat label="Total lost" value={fmt(summary.totalLost ?? 0)} unit={profile.units} tone={summary.totalLost && summary.totalLost > 0 ? 'good' : undefined} sub={toGoal != null ? `${fmt(Math.max(0, toGoal))} ${profile.units} to goal` : undefined} />
            <Stat label="Weekly change" value={signed(summary.weeklyChange)} unit={summary.weeklyChange != null ? `${profile.units}/wk` : undefined} sub="Based on 7-day average" />
            <Stat label="Lowest" value={fmt(summary.lowest ?? summary.current ?? profile.startWeight)} unit={profile.units} />
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 4 }}>
              <h2>Weight</h2>
              <a href="#/progress/weight" className="link">
                Log & history
              </a>
            </div>
            {wPts.length ? (
              <LineChart raw={wPts} trend={movingAverage(wPts)} unit={profile.units} goal={profile.goalWeight} />
            ) : (
              <div className="notice">
                No weigh-ins yet. Log your weight most mornings; the trend line smooths out daily ups and downs.
                <div style={{ marginTop: 10 }}>
                  <Button size="sm" onClick={() => (window.location.hash = '#/progress/weight')}>
                    Log weight
                  </Button>
                </div>
              </div>
            )}
          </div>

          {waists.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 4 }}>
                <h2>Waist</h2>
                <span className="pill">{fmt(waists[waists.length - 1].waist)} {waistUnit(profile.units)}</span>
              </div>
              <LineChart
                raw={waists.map((w) => ({ date: w.date, value: w.waist }))}
                trend={movingAverage(waists.map((w) => ({ date: w.date, value: w.waist })))}
                unit={waistUnit(profile.units)}
                height={180}
              />
            </div>
          )}

          <div className="stat-grid three">
            <Stat label="Streak" value={streak} unit={streak === 1 ? 'day' : 'days'} />
            <Stat label="This week" value={`${Math.round(week.pct * 100)}%`} sub={`${week.done} of ${week.scheduled}`} />
            <Stat label="This month" value={month} unit="done" />
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 8 }}>
              <h2>5K progression</h2>
              <span className="pill accent">Stage {stage.stage} of 8</span>
            </div>
            <ProgressBar value={runProgress(pos.week)} tone="good" />
            <p className="small muted" style={{ marginTop: 8 }}>
              {stage.title}: {stage.summary}
            </p>
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 8 }}>
              <h2>Strength PRs</h2>
              <span className="tiny muted">Best set per exercise</span>
            </div>
            {prs.length ? (
              <div className="list">
                {prs.slice(0, 8).map((pr) => (
                  <a key={pr.exerciseId} href={`#/exercises/${pr.exerciseId}`} className="list-item" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
                    <div className="grow">
                      <div className="title small">{EXERCISE_MAP[pr.exerciseId]?.name}</div>
                      <div className="sub">{formatDate(pr.date)}</div>
                    </div>
                    <div className="num" style={{ fontWeight: 800 }}>
                      {pr.weight} {profile.units} × {pr.reps}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="small muted">Complete a workout to start setting records.</p>
            )}
          </div>

          <div className="list">
            <a href="#/progress/history" className="list-item">
              <div className="grow">
                <div className="title">Workout history</div>
                <div className="sub">{sessions.length} completed</div>
              </div>
              <span className="chev">
                <Icon name="chev" />
              </span>
            </a>
            <a href="#/progress/photos" className="list-item">
              <div className="grow">
                <div className="title">Progress photos</div>
                <div className="sub">Private, stored on this phone</div>
              </div>
              <span className="chev">
                <Icon name="chev" />
              </span>
            </a>
          </div>
        </div>
      </Screen>
      <BottomNav active="progress" />
    </>
  );
}
