import { useEffect, useState } from 'react';
import { saveCardioLog } from '../db/repo';
import { blockBurn, makeCardioLog, sessionBurn } from '../lib/burn';
import type { ExerciseSet, SessionExercise, Unit, WorkoutSession } from '../types';
import { Button } from './ui';

/**
 * Treadmill readout for one cardio block: distance, incline and minutes
 * from the machine's display → ACSM calorie estimate, saved on the session.
 */
export function CardioEntry({
  session,
  index,
  ex,
  units,
  weightKg,
  defaultMinutes,
}: {
  session: WorkoutSession;
  index: number;
  ex: SessionExercise;
  units: Unit;
  weightKg: number;
  defaultMinutes: number;
}) {
  const [distance, setDistance] = useState(ex.cardio ? String(ex.cardio.distance) : '');
  const [incline, setIncline] = useState(ex.cardio ? String(ex.cardio.incline) : '0');
  const [minutes, setMinutes] = useState(String(ex.cardio?.minutes ?? defaultMinutes));
  const [saved, setSaved] = useState(!!ex.cardio);
  useEffect(() => {
    if (ex.cardio) {
      setDistance(String(ex.cardio.distance));
      setIncline(String(ex.cardio.incline));
      setMinutes(String(ex.cardio.minutes));
      setSaved(true);
    }
  }, [ex.cardio]);
  const d = Number(distance) || 0;
  const inc = Number(incline) || 0;
  const min = Number(minutes) || 0;
  const preview = d > 0 && min > 0 ? makeCardioLog(d, inc, min, units, weightKg).kcal : 0;
  const fallback = ex.blockId && ex.completed ? blockBurn(ex.blockId, session.week, weightKg) : 0;
  const dirty = !ex.cardio || ex.cardio.distance !== d || ex.cardio.incline !== inc || ex.cardio.minutes !== min;
  const unit = units === 'kg' ? 'km' : 'mi';

  const save = async () => {
    const log = d > 0 && min > 0 ? makeCardioLog(d, inc, min, units, weightKg) : undefined;
    await saveCardioLog(session.id, index, log, (s, sets: ExerciseSet[]) => sessionBurn(s, sets, weightKg));
    setSaved(true);
  };

  return (
    <div className="cardio-entry">
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="eyebrow">Treadmill readout</span>
        <span className="small num" style={{ fontWeight: 700 }}>
          {preview > 0 ? `≈ ${preview} kcal` : fallback > 0 ? `≈ ${fallback} kcal (from intervals)` : ''}
        </span>
      </div>
      <div className="cardio-grid">
        <label className="num-in">
          <input id={`cardio-distance-${index}`} type="number" inputMode="decimal" step={0.01} min={0} placeholder="0.00" value={distance} onChange={(e) => (setDistance(e.target.value), setSaved(false))} aria-label="Distance" />
          <span>{unit}</span>
        </label>
        <label className="num-in">
          <input id={`cardio-incline-${index}`} type="number" inputMode="decimal" step={0.5} min={0} value={incline} onChange={(e) => (setIncline(e.target.value), setSaved(false))} aria-label="Incline percent" />
          <span>% incl</span>
        </label>
        <label className="num-in">
          <input id={`cardio-minutes-${index}`} type="number" inputMode="numeric" step={1} min={0} value={minutes} onChange={(e) => (setMinutes(e.target.value), setSaved(false))} aria-label="Minutes" />
          <span>min</span>
        </label>
        <Button size="sm" variant={saved && !dirty ? 'secondary' : 'primary'} disabled={!d || !min || (saved && !dirty)} onClick={() => void save()}>
          {saved && !dirty ? 'Saved' : 'Save'}
        </Button>
      </div>
      <div className="tiny muted" style={{ marginTop: 4 }}>
        Copy distance and incline from the treadmill when you step off. {d > 0 ? '' : 'Without it, the intervals are used as a rough estimate.'}
      </div>
    </div>
  );
}
