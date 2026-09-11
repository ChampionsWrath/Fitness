import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { clearTimer, setTimer } from '../db/repo';
import { formatClock } from '../lib/dates';
import { beep, useNow, vibrate } from '../lib/timer';
import type { TimerState } from '../types';
import { Button, Icon } from './ui';

const PRESETS = [30, 60, 90, 120];

export async function startRest(seconds: number, label?: string) {
  await setTimer({ kind: 'rest', endsAt: Date.now() + seconds * 1000, totalSeconds: seconds, label });
}

/** Floating rest timer. Persisted in IndexedDB so it survives reloads and the lock screen. */
export function RestTimer() {
  const timer = useLiveQuery(async () => (await db.meta.get('timer'))?.value as TimerState | undefined, []);
  const active = !!timer && timer.kind === 'rest';
  const now = useNow(active);
  const [collapsed, setCollapsed] = useState(false);
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState('75');
  const firedFor = useRef<number | null>(null);

  const remaining = active ? (timer!.endsAt - now) / 1000 : 0;
  const finished = active && remaining <= 0;

  useEffect(() => {
    if (!active) {
      firedFor.current = null;
      setCollapsed(false);
      return;
    }
    if (finished && firedFor.current !== timer!.endsAt) {
      firedFor.current = timer!.endsAt;
      beep(3);
      vibrate();
      const id = window.setTimeout(() => void clearTimer(), 4000);
      return () => window.clearTimeout(id);
    }
  }, [active, finished, timer]);

  if (!active) return null;

  const total = timer!.totalSeconds;
  const pct = Math.max(0, Math.min(1, remaining / total));

  if (collapsed) {
    return (
      <button
        className="btn secondary"
        onClick={() => setCollapsed(false)}
        style={{ position: 'fixed', left: 20, right: 20, bottom: 'calc(var(--nav-h) + var(--sab) + 12px)', zIndex: 45, maxWidth: 520, margin: '0 auto', boxShadow: 'var(--shadow)' }}
      >
        {finished ? 'Rest complete' : `Rest ${formatClock(remaining)}`}
      </button>
    );
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={() => setCollapsed(true)} />
      <div className="sheet" role="dialog" aria-live="polite">
        <div className="grab" />
        <div className="row between">
          <div className="eyebrow">{finished ? 'Rest complete' : `Rest ${total} sec`}</div>
          <button className="icon-btn" aria-label="Minimise" onClick={() => setCollapsed(true)}>
            <Icon name="x" />
          </button>
        </div>
        <div className="timer-big num" style={{ color: finished ? 'var(--good)' : undefined }}>
          {finished ? 'GO' : formatClock(remaining)}
        </div>
        <div className="progress" style={{ marginBottom: 18 }}>
          <div style={{ width: `${pct * 100}%`, transition: 'none' }} />
        </div>
        {timer!.label && (
          <p className="muted small" style={{ textAlign: 'center', marginBottom: 14 }}>
            Next: {timer!.label}
          </p>
        )}
        <div className="timer-opts">
          {PRESETS.map((s) => (
            <button key={s} className={total === s && !custom ? 'on' : ''} onClick={() => void startRest(s, timer!.label)}>
              {s}s
            </button>
          ))}
          <button className={custom ? 'on' : ''} onClick={() => setCustom((c) => !c)}>
            Custom
          </button>
        </div>
        {custom && (
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input num grow" type="number" inputMode="numeric" value={customVal} onChange={(e) => setCustomVal(e.target.value)} aria-label="Custom seconds" />
            <Button variant="secondary" onClick={() => void startRest(Math.max(5, Number(customVal) || 60), timer!.label)}>
              Set
            </Button>
          </div>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <Button variant="secondary" className="grow" onClick={() => void setTimer({ ...timer!, endsAt: Math.max(timer!.endsAt, Date.now()) + 15000, totalSeconds: total + 15 })}>
            +15s
          </Button>
          <Button variant="primary" className="grow" onClick={() => void clearTimer()}>
            {finished ? 'Continue' : 'Skip rest'}
          </Button>
        </div>
      </div>
    </>
  );
}
