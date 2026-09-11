import { useMemo, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { ExerciseVisual } from '../components/ExerciseVisual';
import { Icon, Screen } from '../components/ui';
import { EXERCISES } from '../data/exercises';
import { ALL_EQUIPMENT, type MuscleGroup, type UserProfile } from '../types';
import { ExerciseDetailContent } from './ExerciseDetail';

const GROUPS: { id: 'all' | MuscleGroup | 'mine'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'My equipment' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Arms' },
  { id: 'quads', label: 'Legs' },
  { id: 'heart & lungs', label: 'Cardio' },
];

export function ExerciseLibrary({ profile }: { profile: UserProfile }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<(typeof GROUPS)[number]['id']>('all');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return EXERCISES.filter((e) => {
      if (needle && !`${e.name} ${e.plainName} ${e.muscles.join(' ')}`.toLowerCase().includes(needle)) return false;
      if (group === 'all') return true;
      if (group === 'mine') return e.equipment.every((eq) => profile.equipment.includes(eq));
      if (group === 'biceps') return e.muscles.includes('biceps') || e.muscles.includes('triceps');
      if (group === 'quads') return e.muscles.some((m) => ['quads', 'hamstrings', 'glutes', 'calves'].includes(m));
      if (group === 'back') return e.muscles.includes('back') || e.muscles.includes('lats');
      return e.muscles.includes(group);
    });
  }, [q, group, profile.equipment]);

  return (
    <>
      <Screen title="Exercises">
        <div className="stack">
          <input className="input" type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
          <div className="chips">
            {GROUPS.map((g) => (
              <button key={g.id} className={`chip ${group === g.id ? 'on' : ''}`} onClick={() => setGroup(g.id)}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="list">
            {list.map((e) => {
              const canDo = e.equipment.every((eq) => profile.equipment.includes(eq));
              return (
                <a key={e.id} href={`#/exercises/${e.id}`} className="list-item">
                  <ExerciseVisual exerciseId={e.id} size="sm" />
                  <div className="grow">
                    <div className="title">{e.name}</div>
                    <div className="sub">
                      {e.equipment.length ? e.equipment.map((x) => ALL_EQUIPMENT.find((a) => a.id === x)?.label).join(' + ') : 'No equipment'}
                      {!canDo && ' · alternative available'}
                    </div>
                  </div>
                  <span className="chev">
                    <Icon name="chev" />
                  </span>
                </a>
              );
            })}
            {!list.length && <div className="notice">No exercises match.</div>}
          </div>
        </div>
      </Screen>
      <BottomNav active="exercises" />
    </>
  );
}

export function ExercisePage({ id, profile, onBack }: { id: string; profile: UserProfile; onBack: () => void }) {
  return (
    <>
      <Screen onBack={onBack}>
        <ExerciseDetailContent exerciseId={id} units={profile.units} showHistory />
      </Screen>
      <BottomNav active="exercises" />
    </>
  );
}
