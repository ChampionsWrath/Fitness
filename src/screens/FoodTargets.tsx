import { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { Button, Field, NumberInput, Screen, Segmented, Stat } from '../components/ui';
import { saveProfile } from '../db/repo';
import { ACTIVITY, BASELINE_STEPS, computeTargets } from '../lib/nutrition';
import { useNutrition } from '../hooks/useNutrition';
import type { ActivityLevel, NutritionSettings, Sex, UserProfile } from '../types';

export function NutritionSetup({ profile, onSaved }: { profile: UserProfile; onSaved?: () => void }) {
  const { currentWeight } = useNutrition(profile);
  const base = profile.nutrition;
  const [sex, setSex] = useState<Sex>(base?.sex ?? 'unspecified');
  const [age, setAge] = useState<number | ''>(base?.age ?? '');
  const [activity, setActivity] = useState<ActivityLevel>(base?.activity ?? 'desk');
  const [pace, setPace] = useState<number>(base?.pace ?? (profile.units === 'kg' ? 0.5 : 1));
  const [heightIn, setHeightIn] = useState<number | ''>(profile.heightCm ? Math.round(profile.heightCm / 2.54) : '');
  const [heightCm, setHeightCm] = useState<number | ''>(profile.heightCm ? Math.round(profile.heightCm) : '');
  const [calorieOverride, setCalorieOverride] = useState<number | ''>(base?.calorieOverride ?? '');
  const [proteinOverride, setProteinOverride] = useState<number | ''>(base?.proteinOverride ?? '');
  const [countSteps, setCountSteps] = useState<boolean>(base?.countSteps !== false);
  const [saved, setSaved] = useState(false);

  const cm = profile.units === 'kg' ? (heightCm === '' ? undefined : Number(heightCm)) : heightIn === '' ? undefined : Number(heightIn) * 2.54;
  const draft: NutritionSettings = {
    sex,
    age: Number(age) || 30,
    activity,
    pace,
    calorieOverride: calorieOverride === '' ? undefined : Number(calorieOverride),
    proteinOverride: proteinOverride === '' ? undefined : Number(proteinOverride),
    countSteps,
    updatedAt: Date.now(),
  };
  const preview = computeTargets({ ...profile, heightCm: cm ?? profile.heightCm }, currentWeight, draft);
  const paces = profile.units === 'kg' ? [0.25, 0.5, 0.75, 1] : [0.5, 1, 1.5, 2];
  const valid = age !== '' && Number(age) > 10 && cm;

  const save = async () => {
    await saveProfile({ ...profile, heightCm: cm ?? profile.heightCm, nutrition: draft });
    setSaved(true);
    onSaved?.();
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="muted">Targets come from your current weight ({currentWeight} {profile.units}), goal ({profile.goalWeight} {profile.units}) and a few details. Nothing here is medical advice.</p>
      <Field label="Sex (for the calorie formula)">
        <Segmented<Sex>
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'unspecified', label: 'Prefer not' },
          ]}
          value={sex}
          onChange={setSex}
        />
      </Field>
      <div className="row">
        <Field label="Age">
          <NumberInput id="nt-age" value={age} onChange={setAge} suffix="yrs" />
        </Field>
        <Field label="Height">
          {profile.units === 'kg' ? <NumberInput id="nt-height" value={heightCm} onChange={setHeightCm} suffix="cm" /> : <NumberInput id="nt-height" value={heightIn} onChange={setHeightIn} suffix="in" placeholder="e.g. 70" />}
        </Field>
      </div>
      <Field label="Everyday activity (not counting workouts)">
        <div className="check-list">
          {(Object.keys(ACTIVITY) as ActivityLevel[]).map((k) => (
            <button key={k} className={`check-item ${activity === k ? 'on' : ''}`} onClick={() => setActivity(k)} aria-pressed={activity === k}>
              <span className="box">{activity === k && '•'}</span>
              <span>
                <div className="lbl">{ACTIVITY[k].label}</div>
                <div className="hint">{ACTIVITY[k].hint}</div>
              </span>
            </button>
          ))}
        </div>
      </Field>
      <Field label={`Pace (${profile.units} per week)`} hint="1 lb (0.5 kg) a week is the sweet spot for keeping muscle. Faster is harder to stick to.">
        <Segmented options={paces.map((p) => ({ value: String(p), label: String(p) }))} value={String(pace)} onChange={(v) => setPace(Number(v))} />
      </Field>

      <div className="card flat">
        <div className="eyebrow">Your daily targets</div>
        <div className="stat-grid" style={{ marginTop: 10 }}>
          <Stat label="Net calories" value={preview.kcal.toLocaleString()} unit="kcal" sub={`${preview.tdee.toLocaleString()} without exercise − ${preview.deficit}`} />
          <Stat label="Protein" value={preview.protein} unit="g" sub="0.8 g per lb of goal weight" />
          <Stat label="Carbs" value={preview.carbs} unit="g" sub="What's left after protein and fat" />
          <Stat label="Fat" value={preview.fat} unit="g" sub="28% of calories" />
        </div>
        {preview.floored && <p className="tiny" style={{ color: 'var(--warn)', marginTop: 8 }}>Capped at a safe minimum. Pick a slower pace or expect loss to be slower than chosen.</p>}
        <p className="tiny muted" style={{ marginTop: 8 }}>
          Weekly: {(preview.kcal * 7).toLocaleString()} net kcal · {preview.protein * 7}g protein. Each workout and your daily steps are subtracted from what you eat, so training days earn extra room. Targets update automatically as your weight comes down.
        </p>
      </div>

      <Field label="Steps">
        <button className={`check-item ${countSteps ? 'on' : ''}`} onClick={() => setCountSteps((v) => !v)} aria-pressed={countSteps}>
          <span className="box">{countSteps && '•'}</span>
          <span>
            <div className="lbl">Count daily steps toward calories</div>
            <div className="hint">Steps above roughly {BASELINE_STEPS[activity].toLocaleString()} a day (already assumed by “{ACTIVITY[activity].label}”) count as calories burned that day.</div>
          </span>
        </button>
      </Field>

      <details>
        <summary className="small" style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>
          Manual overrides
        </summary>
        <div className="row" style={{ marginTop: 10 }}>
          <Field label="Calories" hint="Leave blank for automatic">
            <NumberInput value={calorieOverride} onChange={setCalorieOverride} suffix="kcal" />
          </Field>
          <Field label="Protein" hint="Leave blank for automatic">
            <NumberInput value={proteinOverride} onChange={setProteinOverride} suffix="g" />
          </Field>
        </div>
      </details>

      <Button size="lg" full disabled={!valid} onClick={() => void save()}>
        {saved ? 'Saved' : base ? 'Save targets' : 'Set my targets'}
      </Button>
    </div>
  );
}

export function FoodTargets({ profile, onBack }: { profile: UserProfile; onBack: () => void }) {
  return (
    <>
      <Screen title="Targets" onBack={onBack}>
        <NutritionSetup profile={profile} onSaved={onBack} />
      </Screen>
      <BottomNav active="food" />
    </>
  );
}
