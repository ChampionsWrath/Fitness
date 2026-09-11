import { useLiveQuery } from 'dexie-react-hooks';
import { ExerciseVisual } from '../components/ExerciseVisual';
import { Button, Icon } from '../components/ui';
import { EXERCISE_MAP, getExercise } from '../data/exercises';
import { FORM_REMINDERS } from '../data/disclaimer';
import { getHistoryForExercise } from '../db/repo';
import { formatDate } from '../lib/dates';
import { computePRs } from '../lib/overload';
import { ALL_EQUIPMENT, type Unit } from '../types';

const DIFF: Record<string, string> = { beginner: 'Beginner', easy: 'Easy', moderate: 'Moderate' };

export function ExerciseDetailContent({
  exerciseId,
  units,
  onStart,
  substitutedFor,
  showHistory,
}: {
  exerciseId: string;
  units: Unit;
  onStart?: () => void;
  substitutedFor?: string;
  showHistory?: boolean;
}) {
  const ex = getExercise(exerciseId);
  const history = useLiveQuery(() => (showHistory ? getHistoryForExercise(exerciseId) : Promise.resolve([])), [exerciseId, showHistory]) ?? [];
  const pr = computePRs(history)[exerciseId];
  const byDate = new Map<string, typeof history>();
  for (const s of history) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  return (
    <div className="stack" style={{ gap: 0 }}>
      <div className="eyebrow">{ex.muscles.join(' · ')}</div>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', textTransform: 'uppercase', lineHeight: 1.05, margin: '4px 0 12px' }}>{ex.name}</h1>
      <ExerciseVisual exerciseId={ex.id} size="lg" />
      <p style={{ fontSize: 18, fontWeight: 600, marginTop: 14, lineHeight: 1.4 }}>{ex.plainName}</p>
      {substitutedFor && (
        <div className="notice" style={{ marginTop: 12 }}>
          Replaces <b>{EXERCISE_MAP[substitutedFor]?.name}</b> because you don’t have the equipment for it.
        </div>
      )}
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 6 }}>
        <span className="pill">{DIFF[ex.difficulty]}</span>
        <span className="pill">{ex.equipment.length ? ex.equipment.map((e) => ALL_EQUIPMENT.find((a) => a.id === e)?.label ?? e).join(' + ') : 'No equipment'}</span>
        {ex.kind === 'strength' && <span className="pill accent">Start with {ex.beginnerWeight}</span>}
      </div>

      {onStart && (
        <div style={{ marginTop: 18 }}>
          <Button size="lg" full onClick={onStart}>
            <Icon name="play" size={18} /> START EXERCISE
          </Button>
        </div>
      )}

      <div className="detail-block">
        <h3>Starting position</h3>
        <p>{ex.startingPosition}</p>
      </div>
      <div className="detail-block">
        <h3>Movement</h3>
        <ol>
          {ex.movement.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ol>
      </div>
      {ex.safety && (
        <div className="detail-block">
          <div className="safety">{ex.safety}</div>
        </div>
      )}
      <div className="detail-block">
        <h3>Common mistakes</h3>
        <ul>
          {ex.commonMistakes.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>
      <div className="detail-block">
        <h3>Beginner tips</h3>
        <ul>
          {ex.beginnerTips.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>
      <div className="detail-block">
        <h3>Muscles worked</h3>
        <p style={{ textTransform: 'capitalize' }}>{ex.muscles.join(', ')}</p>
      </div>
      {ex.kind === 'strength' && (
        <div className="detail-block">
          <h3>Recommended beginner weight</h3>
          <p>{ex.beginnerWeight}. Choose a weight where the last two reps of each set feel hard but your form stays clean.</p>
        </div>
      )}
      {ex.alternatives.length > 0 && (
        <div className="detail-block">
          <h3>Alternative{ex.alternatives.length > 1 ? 's' : ''}</h3>
          <div className="list">
            {ex.alternatives.map((a) => {
              const alt = EXERCISE_MAP[a];
              if (!alt) return null;
              return (
                <a key={a} href={`#/exercises/${a}`} className="list-item">
                  <ExerciseVisual exerciseId={a} size="sm" />
                  <div className="grow">
                    <div className="title">{alt.name}</div>
                    <div className="sub">{alt.equipment.length ? alt.equipment.map((e) => ALL_EQUIPMENT.find((x) => x.id === e)?.label).join(' + ') : 'No equipment'}</div>
                  </div>
                  <span className="chev">
                    <Icon name="chev" />
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
      <div className="detail-block">
        <h3>Safety reminders</h3>
        <ul>
          {FORM_REMINDERS.map((m, i) => (
            <li key={i} className="small muted">
              {m}
            </li>
          ))}
        </ul>
      </div>
      {showHistory && history.length > 0 && (
        <div className="detail-block">
          <h3>Your history</h3>
          {pr && (
            <div className="reco" style={{ marginBottom: 12 }}>
              <b>Best:</b> {pr.weight} {units} × {pr.reps} on {formatDate(pr.date)}
            </div>
          )}
          <div className="list">
            {[...byDate.entries()].slice(0, 12).map(([date, sets]) => (
              <div key={date} className="list-item">
                <div className="grow">
                  <div className="title small">{formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  <div className="sub num">{sets.map((s) => (s.weight > 0 ? `${s.weight}×${s.reps}` : `${s.reps}`)).join('  ·  ')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
