import { useMemo, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { ExerciseVisual } from '../components/ExerciseVisual';
import { Button, Field, Icon, NumberInput, Screen, Sheet } from '../components/ui';
import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import { logPastWorkout } from '../db/repo';
import { useNutrition } from '../hooks/useNutrition';
import { navigate } from '../hooks/useRoute';
import { todayISO } from '../lib/dates';
import type { UserProfile } from '../types';

type DraftSet = { weight: number | ''; reps: number | '' };
type DraftExercise = { exerciseId: string; sets: DraftSet[] };

export function LogPastWorkout({ profile, onBack }: { profile: UserProfile; onBack: () => void }) {
  const { weightKg } = useNutrition(profile);
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return EXERCISES.filter((e) => `${e.name} ${e.plainName} ${e.muscles.join(' ')}`.toLowerCase().includes(needle)).slice(0, 20);
  }, [q]);

  const addExercise = (exerciseId: string) => {
    setExercises((cur) => (cur.some((e) => e.exerciseId === exerciseId) ? cur : [...cur, { exerciseId, sets: [{ weight: '', reps: '' }] }]));
    setPickerOpen(false);
    setQ('');
  };

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<DraftSet>) => {
    setExercises((cur) => cur.map((e, i) => (i !== exIdx ? e : { ...e, sets: e.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) })));
  };

  const addSet = (exIdx: number) => {
    setExercises((cur) => cur.map((e, i) => (i !== exIdx ? e : { ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1] }] })));
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((cur) =>
      cur.map((e, i) => (i !== exIdx ? e : { ...e, sets: e.sets.filter((_, j) => j !== setIdx) })).filter((e) => e.sets.length > 0),
    );
  };

  const removeExercise = (exIdx: number) => setExercises((cur) => cur.filter((_, i) => i !== exIdx));

  const canSave = exercises.some((e) => e.sets.some((s) => s.reps !== '' && Number(s.reps) > 0));

  const save = async () => {
    setSaving(true);
    const payload = exercises
      .map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets.filter((s) => s.reps !== '' && Number(s.reps) > 0).map((s) => ({ weight: s.weight === '' ? 0 : Number(s.weight), reps: Number(s.reps) })),
      }))
      .filter((e) => e.sets.length > 0);
    const session = await logPastWorkout({ date, title, exercises: payload, weightKg });
    navigate(`/progress/history/${session.id}`);
  };

  return (
    <>
      <Screen title="Log a past workout" onBack={onBack}>
        <div className="stack">
          <p className="small muted">
            For a workout you already did but never logged — a missed day, a wipe, a forgotten entry. Enter the date and what you lifted; since we don’t have your real set timing, the calorie
            estimate uses a typical work-and-rest time per set instead.
          </p>
          <div className="card stack" style={{ gap: 12 }}>
            <Field label="Date">
              <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </Field>
            <Field label="Title (optional)">
              <input className="input" placeholder="e.g. Upper body" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          </div>

          {exercises.map((ex, exIdx) => {
            const def = EXERCISE_MAP[ex.exerciseId];
            return (
              <div key={ex.exerciseId} className="card stack" style={{ gap: 10 }}>
                <div className="row between">
                  <div className="row" style={{ gap: 8 }}>
                    <ExerciseVisual exerciseId={ex.exerciseId} size="sm" />
                    <div className="title">{def?.name ?? ex.exerciseId}</div>
                  </div>
                  <button className="icon-btn" aria-label={`Remove ${def?.name ?? ex.exerciseId}`} onClick={() => removeExercise(exIdx)}>
                    <Icon name="trash" />
                  </button>
                </div>
                {ex.sets.map((s, setIdx) => (
                  <div key={setIdx} className="row" style={{ gap: 8 }}>
                    <div className="grow">
                      <NumberInput value={s.weight} onChange={(v) => updateSet(exIdx, setIdx, { weight: v })} suffix={profile.units} step={2.5} min={0} placeholder="Weight" />
                    </div>
                    <div className="grow">
                      <NumberInput value={s.reps} onChange={(v) => updateSet(exIdx, setIdx, { reps: v })} suffix="reps" step={1} min={0} placeholder="Reps" />
                    </div>
                    <button className="icon-btn" aria-label={`Remove set ${setIdx + 1}`} onClick={() => removeSet(exIdx, setIdx)}>
                      <Icon name="minus" />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => addSet(exIdx)}>
                  <Icon name="plus" size={16} /> Add set
                </Button>
              </div>
            );
          })}

          <Button variant="secondary" full onClick={() => setPickerOpen(true)}>
            <Icon name="plus" size={18} /> Add exercise
          </Button>

          <Button size="lg" full disabled={!canSave || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save workout'}
          </Button>
        </div>
      </Screen>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add exercise">
        <div className="stack" style={{ gap: 10 }}>
          <input className="input" type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" autoFocus />
          <div className="list">
            {results.map((e) => (
              <button key={e.id} className="list-item" onClick={() => addExercise(e.id)}>
                <ExerciseVisual exerciseId={e.id} size="sm" />
                <div className="grow">
                  <div className="title">{e.name}</div>
                </div>
              </button>
            ))}
            {q.trim() && !results.length && <div className="notice">No exercises match.</div>}
          </div>
        </div>
      </Sheet>
      <BottomNav active="progress" />
    </>
  );
}
