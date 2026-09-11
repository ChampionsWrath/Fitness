import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { FoodSearch } from '../components/FoodSearch';
import { Button, Icon, NumberInput, Screen, Sheet } from '../components/ui';
import { deleteFoodEntry, getSteps, listFoodEntries, listFoodEntriesBetween, listStepsBetween, upsertSteps } from '../db/repo';
import { WEEKDAY_SHORT, addDays, formatDate, startOfWeek, todayISO, weekdayOf } from '../lib/dates';
import { BASELINE_STEPS, MEALS, defaultMealForNow, sumEntries, summarizeWeek } from '../lib/nutrition';

const BASELINE_LABEL = Object.fromEntries(Object.entries(BASELINE_STEPS).map(([k, v]) => [k, v.toLocaleString()])) as Record<keyof typeof BASELINE_STEPS, string>;
import { useNutrition, useWorkoutsBetween, workoutBurn, workoutBurnSplit } from '../hooks/useNutrition';
import type { FoodEntry, MealType, UserProfile } from '../types';
import { NutritionSetup } from './FoodTargets';

export function FoodTab({ profile, date: routeDate }: { profile: UserProfile; date?: string }) {
  const today = todayISO();
  const date = routeDate ?? today;
  const { targets, bonusFor } = useNutrition(profile);
  const stepsEntry = useLiveQuery(() => getSteps(date), [date]);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [stepsDraft, setStepsDraft] = useState<number | ''>('');
  const entries = useLiveQuery(() => listFoodEntries(date), [date]) ?? [];
  const weekStart = startOfWeek(date);
  const weekEntries = useLiveQuery(() => listFoodEntriesBetween(weekStart, addDays(weekStart, 6)), [weekStart]) ?? [];
  const weekSteps = useLiveQuery(() => listStepsBetween(weekStart, addDays(weekStart, 6)), [weekStart]) ?? [];
  const weekWorkouts = useWorkoutsBetween(weekStart, addDays(weekStart, 6));
  const [adding, setAdding] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const totals = sumEntries(entries);
  const go = (d: string) => (window.location.hash = d === today ? '#/food' : `#/food/day/${d}`);

  if (!profile.nutrition) {
    return (
      <>
        <Screen title="Food" eyebrow="Set your targets">
          <NutritionSetup profile={profile} />
        </Screen>
        <BottomNav active="food" />
      </>
    );
  }
  const t = targets!;
  const stepBonus = bonusFor(stepsEntry?.steps);
  const workoutKcal = workoutBurn(weekWorkouts, date);
  const split = workoutBurnSplit(weekWorkouts, date);
  const burnedToday = stepBonus + workoutKcal;
  const net = totals.kcal - burnedToday;
  const dayTarget = t.kcal;
  const left = dayTarget - net;
  const burnedByDate: Record<string, number> = {};
  for (const s of weekSteps) burnedByDate[s.date] = (burnedByDate[s.date] ?? 0) + bonusFor(s.steps);
  for (const w of weekWorkouts) burnedByDate[w.date] = (burnedByDate[w.date] ?? 0) + (w.caloriesBurned ?? 0);
  const week = summarizeWeek(weekEntries, t, date, burnedByDate);
  const stepDays = weekSteps.filter((s) => s.steps > 0);
  const avgSteps = stepDays.length ? Math.round(stepDays.reduce((a, s) => a + s.steps, 0) / stepDays.length) : 0;
  const pct = (v: number, max: number) => (max ? v / max : 0);
  const weekMax = Math.max(t.kcal * 1.3, ...week.days.map((d) => Math.max(d.net, d.target)));
  const countSteps = profile.nutrition.countSteps !== false;

  return (
    <>
      <Screen
        title="Food"
        eyebrow={date === today ? 'Today' : formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}
        right={
          <a href="#/food/targets" className="icon-btn" aria-label="Targets and settings">
            <Icon name="settings" />
          </a>
        }
      >
        <div className="stack">
          <div className="day-nav">
            <button className="icon-btn" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>
              <Icon name="back" />
            </button>
            <button className="d" onClick={() => go(today)}>
              {date === today ? 'Today' : formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}
            </button>
            <button className="icon-btn" aria-label="Next day" disabled={date >= today} style={{ opacity: date >= today ? 0.3 : 1 }} onClick={() => go(addDays(date, 1))}>
              <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>
                <Icon name="back" />
              </span>
            </button>
          </div>

          <div className="card">
            <div className="kcal-hero">
              <div>
                <div className="eyebrow">Net calories</div>
                <div className="big">
                  {net.toLocaleString()}
                  <small>of {dayTarget.toLocaleString()} kcal</small>
                </div>
              </div>
              <div className="left">
                <b style={{ color: left < 0 ? 'var(--warn)' : undefined }}>{Math.abs(left).toLocaleString()}</b>
                <span className="tiny muted">{left < 0 ? 'over' : 'left'}</span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className={`progress ${left < 0 ? 'over' : ''}`}>
                <div style={{ width: `${Math.min(100, pct(Math.max(0, net), dayTarget) * 100)}%` }} />
              </div>
            </div>
            <div className="burn-line num">
              <span>
                Eaten <b>{totals.kcal.toLocaleString()}</b>
              </span>
              <span>
                Burned <b>{burnedToday.toLocaleString()}</b>
                <span className="muted">
                  {' '}
                  {[split.lifting > 0 ? `lifting ${split.lifting}` : '', split.cardio > 0 ? `treadmill ${split.cardio}` : '', stepBonus > 0 ? `steps ${stepBonus}` : ''].filter(Boolean).length
                    ? `(${[split.lifting > 0 ? `lifting ${split.lifting}` : '', split.cardio > 0 ? `treadmill ${split.cardio}` : '', stepBonus > 0 ? `steps ${stepBonus}` : ''].filter(Boolean).join(' + ')})`
                    : ''}
                </span>
              </span>
            </div>
            <button
              className="steps-row"
              onClick={() => {
                setStepsDraft(stepsEntry?.steps ?? '');
                setStepsOpen(true);
              }}
              aria-label="Enter steps"
            >
              <span className="walk">
                <Icon name="steps" size={18} />
              </span>
              <span className="grow">
                {stepsEntry ? (
                  <>
                    <b className="num">{stepsEntry.steps.toLocaleString()}</b> steps
                    {countSteps && (
                      <span className="muted">
                        {' '}
                        · {stepBonus > 0 ? `+${stepBonus} kcal` : 'within your usual activity'}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="muted">Add today’s steps from your pedometer</span>
                )}
              </span>
              <span className="chev">
                <Icon name="chev" />
              </span>
            </button>
            <div className="macro-row">
              {(
                [
                  ['protein', 'Protein', totals.protein, t.protein],
                  ['carbs', 'Carbs', totals.carbs, t.carbs],
                  ['fat', 'Fat', totals.fat, t.fat],
                ] as const
              ).map(([key, label, val, max]) => (
                <div key={key} className={`macro ${key}`}>
                  <div className="lbl">
                    <span>{label}</span>
                  </div>
                  <div className="val">
                    {Math.round(val)}
                    <small> / {max}g</small>
                  </div>
                  <div className={`progress ${val > max * 1.1 && key !== 'protein' ? 'over' : ''}`}>
                    <div style={{ width: `${Math.min(100, pct(val, max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {MEALS.map((m) => {
            const rows = entries.filter((e) => e.meal === m.id);
            const s = sumEntries(rows);
            return (
              <div key={m.id} className="meal">
                <div className="meal-head">
                  <h3>{m.label}</h3>
                  <span className="kcal">{rows.length ? `${s.kcal} kcal · ${Math.round(s.protein)}g protein` : ''}</span>
                </div>
                {rows.map((e) => (
                  <button key={e.id} className="entry" onClick={() => setEditing(e)}>
                    <div className="grow">
                      <div className="nm">{e.name}</div>
                      <div className="qty">
                        {e.quantity} × {e.servingLabel}
                      </div>
                    </div>
                    <div className="kc">
                      {e.kcal}
                      <small>
                        P{Math.round(e.protein)} C{Math.round(e.carbs)} F{Math.round(e.fat)}
                      </small>
                    </div>
                  </button>
                ))}
                <button className="add" onClick={() => setAdding(m.id)}>
                  <Icon name="plus" size={18} /> Add food
                </button>
              </div>
            );
          })}

          <div className="card">
            <div className="section-title" style={{ marginBottom: 6 }}>
              <h2>This week</h2>
              <span className={`pill ${week.remaining < 0 ? '' : 'good'}`}>{week.remaining < 0 ? `${Math.abs(week.remaining).toLocaleString()} over` : `${week.remaining.toLocaleString()} left`}</span>
            </div>
            <p className="small muted" style={{ marginBottom: 10 }}>
              Net {week.consumed.toLocaleString()} of {week.budget.toLocaleString()} kcal (ate {week.eaten.toLocaleString()}, burned {week.burned.toLocaleString()}) · avg {week.avgPerDay.toLocaleString()} net and {week.proteinAvg}g protein on logged days
            </p>
            <div className="week-bars" aria-label="Calories per day this week">
              {week.days.map((d) => (
                <div key={d.date} className="col">
                  <div
                    className={`bar ${!d.logged ? 'empty' : d.net > d.target * 1.1 ? 'over' : ''} ${d.date === date ? 'today' : ''}`}
                    style={{ height: `${d.logged ? Math.max(4, (Math.max(0, d.net) / weekMax) * 100) : 4}%` }}
                    title={`${d.net} net kcal (ate ${d.eaten}, burned ${d.burned})`}
                  />
                  <span className="lbl">{WEEKDAY_SHORT[weekdayOf(d.date)].slice(0, 2)}</span>
                </div>
              ))}
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Weekly budget is {t.kcal.toLocaleString()} × 7. Workouts{countSteps ? ' and steps' : ''} are subtracted from what you eat, so a hard day earns room. Days above target show in amber.
              {avgSteps > 0 && ` Averaging ${avgSteps.toLocaleString()} steps on ${stepDays.length} logged day${stepDays.length === 1 ? '' : 's'}.`}
            </p>
          </div>

          <div className="notice">
            Target: {t.kcal.toLocaleString()} net kcal/day for about {profile.nutrition.pace} {profile.units}/week ({t.deficit > 0 ? `${t.deficit} below` : 'at'} your estimated {t.tdee.toLocaleString()} kcal without exercise). Workouts and steps are counted on top, on the day you do them. Protein {t.protein}g keeps muscle while you lose fat.{' '}
            <a href="#/food/targets" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Adjust
            </a>
          </div>
        </div>
      </Screen>

      <Sheet open={stepsOpen} onClose={() => setStepsOpen(false)} title="Steps">
        <div className="stack" style={{ gap: 12 }}>
          <p className="small muted">Copy the number from Pedometer++ (or any step counter) for {date === today ? 'today' : formatDate(date)}.</p>
          <NumberInput id="steps-input" value={stepsDraft} onChange={setStepsDraft} suffix="steps" step={100} min={0} placeholder="e.g. 8500" />
          {countSteps && (
            <div className="notice">
              {Number(stepsDraft) > 0
                ? bonusFor(Number(stepsDraft)) > 0
                  ? `Counts ${bonusFor(Number(stepsDraft))} kcal burned against this day's food.`
                  : `Your activity level already assumes about ${BASELINE_LABEL[profile.nutrition.activity]} steps, so no extra calories yet.`
                : `Steps above about ${BASELINE_LABEL[profile.nutrition.activity]} a day earn extra calories at your weight.`}
            </div>
          )}
          <Button
            size="lg"
            full
            onClick={async () => {
              await upsertSteps(date, Number(stepsDraft) || 0);
              setStepsOpen(false);
            }}
          >
            Save steps
          </Button>
        </div>
      </Sheet>

      <FoodSearch open={adding !== null || !!editing} onClose={() => (setAdding(null), setEditing(null))} date={date} meal={adding ?? defaultMealForNow()} units={profile.units} editing={editing} />
      {editing && (
        <div style={{ position: 'fixed', left: 20, right: 20, bottom: 'calc(var(--sab) + 12px)', zIndex: 60, maxWidth: 520, margin: '0 auto' }}>
          <Button
            variant="danger"
            full
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
            onClick={async () => {
              await deleteFoodEntry(editing.id);
              setEditing(null);
            }}
          >
            Remove from log
          </Button>
        </div>
      )}
      <BottomNav active="food" />
    </>
  );
}
