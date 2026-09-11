import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { LineChart } from '../components/LineChart';
import { Button, Field, Icon, NumberInput, Screen, Stat } from '../components/ui';
import { deleteWaist, deleteWeight, listWaists, listWeights, upsertWaist, upsertWeight } from '../db/repo';
import { formatDate, todayISO } from '../lib/dates';
import { movingAverage, summarizeWeights } from '../lib/stats';
import { fmt, signed, waistUnit } from '../lib/units';
import type { UserProfile } from '../types';

export function WeightTracker({ profile, onBack }: { profile: UserProfile; onBack: () => void }) {
  const weights = useLiveQuery(listWeights, []) ?? [];
  const waists = useLiveQuery(listWaists, []) ?? [];
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState<number | ''>('');
  const [waist, setWaist] = useState<number | ''>('');
  const [savedMsg, setSavedMsg] = useState('');
  const wPts = weights.map((w) => ({ date: w.date, value: w.weight }));
  const summary = summarizeWeights(wPts, profile.startWeight);
  const wu = waistUnit(profile.units);

  const save = async () => {
    if (weight !== '' && Number(weight) > 0) await upsertWeight(date, Number(weight));
    if (waist !== '' && Number(waist) > 0) await upsertWaist(date, Number(waist));
    setSavedMsg(`Saved for ${formatDate(date)}`);
    setWeight('');
    setWaist('');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const rows = [...new Set([...weights.map((w) => w.date), ...waists.map((w) => w.date)])].sort((a, b) => b.localeCompare(a));

  return (
    <>
      <Screen title="Weight" onBack={onBack}>
        <div className="stack">
          <div className="card stack" style={{ gap: 12 }}>
            <div className="row">
              <Field label="Date">
                <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
              </Field>
            </div>
            <div className="row">
              <div className="grow">
                <Field label="Weight">
                  <NumberInput id="wt-weight" value={weight} onChange={setWeight} suffix={profile.units} step={0.1} placeholder={summary.current ? String(summary.current) : ''} />
                </Field>
              </div>
              <div className="grow">
                <Field label="Waist (optional)">
                  <NumberInput id="wt-waist" value={waist} onChange={setWaist} suffix={wu} step={0.1} />
                </Field>
              </div>
            </div>
            <Button size="lg" full disabled={weight === '' && waist === ''} onClick={() => void save()}>
              {savedMsg || 'Save entry'}
            </Button>
            <p className="tiny muted">Weigh in at the same time each day, ideally in the morning. Daily swings of a few pounds are normal water changes, not fat. Watch the trend line.</p>
          </div>

          <div className="stat-grid">
            <Stat label="Current" value={fmt(summary.current ?? profile.startWeight)} unit={profile.units} sub={summary.currentDate ? formatDate(summary.currentDate) : undefined} />
            <Stat label="Starting" value={fmt(profile.startWeight)} unit={profile.units} />
            <Stat label="Lowest" value={fmt(summary.lowest ?? summary.current ?? profile.startWeight)} unit={profile.units} />
            <Stat label="Total lost" value={fmt(summary.totalLost ?? 0)} unit={profile.units} tone={summary.totalLost && summary.totalLost > 0 ? 'good' : undefined} />
            <Stat label="Avg weekly change" value={signed(summary.weeklyChange)} unit={summary.weeklyChange != null ? `${profile.units}/wk` : undefined} sub="From the 7-day average" />
            <Stat label="7-day average" value={fmt(summary.trend)} unit={summary.trend != null ? profile.units : undefined} />
          </div>

          {wPts.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 4 }}>
                <h2>Weight over time</h2>
              </div>
              <LineChart raw={wPts} trend={movingAverage(wPts)} unit={profile.units} goal={profile.goalWeight} />
            </div>
          )}
          {waists.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 4 }}>
                <h2>Waist over time</h2>
              </div>
              <LineChart raw={waists.map((w) => ({ date: w.date, value: w.waist }))} trend={movingAverage(waists.map((w) => ({ date: w.date, value: w.waist })))} unit={wu} height={180} />
            </div>
          )}

          {rows.length > 0 && (
            <div className="section">
              <div className="section-title">
                <h2>Entries</h2>
              </div>
              <div className="list">
                {rows.map((d) => {
                  const w = weights.find((x) => x.date === d);
                  const wa = waists.find((x) => x.date === d);
                  return (
                    <div key={d} className="list-item">
                      <div className="grow">
                        <div className="title small">{formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                        <div className="sub num">
                          {w ? `${w.weight} ${profile.units}` : ''}
                          {w && wa ? ' · ' : ''}
                          {wa ? `waist ${wa.waist} ${wu}` : ''}
                        </div>
                      </div>
                      <button
                        className="icon-btn"
                        aria-label={`Delete entry for ${d}`}
                        onClick={async () => {
                          if (!confirm('Delete this entry?')) return;
                          if (w) await deleteWeight(w.id);
                          if (wa) await deleteWaist(wa.id);
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Screen>
      <BottomNav active="progress" />
    </>
  );
}
