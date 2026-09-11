import { useState } from 'react';
import { defaultProfile, saveProfile } from '../db/repo';
import { todayISO } from '../lib/dates';
import { waistUnit } from '../lib/units';
import { ALL_EQUIPMENT, type Equipment, type Unit, type UserProfile } from '../types';
import { Button, Field, Icon, NumberInput, Segmented } from '../components/ui';
import { DISCLAIMER } from '../data/disclaimer';

const STEPS = 4;

export function Onboarding({ existing }: { existing?: UserProfile | null }) {
  const base = existing ?? defaultProfile();
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState<Unit>(base.units);
  const [weight, setWeight] = useState<number | ''>(base.startWeight || '');
  const [goal, setGoal] = useState<number | ''>(base.goalWeight || '');
  const [waist, setWaist] = useState<number | ''>(base.startWaist ?? '');
  const [ft, setFt] = useState<number | ''>(base.heightCm ? Math.floor(Math.round(base.heightCm / 2.54) / 12) : '');
  const [inch, setInch] = useState<number | ''>(base.heightCm ? Math.round(base.heightCm / 2.54) % 12 : '');
  const [cm, setCm] = useState<number | ''>(base.heightCm ? Math.round(base.heightCm) : '');
  const [equipment, setEquipment] = useState<Equipment[]>(base.equipment);
  const [days, setDays] = useState(base.daysPerWeek);
  const [duration, setDuration] = useState(base.typicalDurationMin);
  const [saving, setSaving] = useState(false);

  const heightCm = units === 'kg' ? (cm === '' ? undefined : Number(cm)) : ft === '' && inch === '' ? undefined : Number(ft || 0) * 30.48 + Number(inch || 0) * 2.54;
  const bodyValid = weight !== '' && Number(weight) > 0 && goal !== '' && Number(goal) > 0;

  const toggle = (id: Equipment) => setEquipment((eq) => (eq.includes(id) ? eq.filter((e) => e !== id) : [...eq, id]));

  const finish = async () => {
    setSaving(true);
    const profile: UserProfile = {
      ...base,
      units,
      startWeight: Number(weight),
      goalWeight: Number(goal),
      startWaist: waist === '' ? undefined : Number(waist),
      heightCm,
      equipment,
      daysPerWeek: days,
      typicalDurationMin: duration,
      programStartDate: existing?.onboardingComplete ? base.programStartDate : todayISO(),
      onboardingComplete: true,
      disclaimerAccepted: true,
      updatedAt: Date.now(),
    };
    await saveProfile(profile);
    window.location.hash = '#/home';
  };

  return (
    <div className="screen no-nav fade-in" style={{ paddingTop: 'calc(var(--sat) + 24px)' }}>
      <div className="onboard-steps" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <div key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <div className="stack" style={{ gap: 18 }}>
          <div className="eyebrow">18-month transformation</div>
          <h1 className="big-title">You don’t need to be fit to start.</h1>
          <p className="muted">
            This program is designed around an 18-month transformation. Three phases, one workout at a time, built for a treadmill and a set of
            dumbbells at home.
          </p>
          <div className="card flat stack" style={{ gap: 10 }}>
            <div>
              <b>Phase 1 · Months 1–3</b>
              <div className="small muted">Learn the movements. Walk your way toward running a 5K.</div>
            </div>
            <div>
              <b>Phase 2 · Months 4–9</b>
              <div className="small muted">Upper / lower split. Heavier weights, more conditioning.</div>
            </div>
            <div>
              <b>Phase 3 · Months 10–18</b>
              <div className="small muted">Strength and physique work: chest, shoulders, back, arms, legs, core.</div>
            </div>
          </div>
          <p className="disclaimer">{DISCLAIMER}</p>
          <Button size="lg" full onClick={() => setStep(1)}>
            I understand, let’s go
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="stack" style={{ gap: 16 }}>
          <h1 className="big-title">About you</h1>
          <Segmented options={[{ value: 'lb', label: 'lb / in' }, { value: 'kg', label: 'kg / cm' }]} value={units} onChange={setUnits} />
          <Field label="Current weight">
            <NumberInput id="ob-weight" value={weight} onChange={setWeight} suffix={units} step={0.1} placeholder="e.g. 220" />
          </Field>
          <Field label="Goal weight">
            <NumberInput id="ob-goal" value={goal} onChange={setGoal} suffix={units} step={0.1} placeholder="e.g. 180" />
          </Field>
          <Field label="Height" hint="Optional">
            {units === 'kg' ? (
              <NumberInput value={cm} onChange={setCm} suffix="cm" />
            ) : (
              <div className="row">
                <div className="grow">
                  <NumberInput value={ft} onChange={setFt} suffix="ft" />
                </div>
                <div className="grow">
                  <NumberInput value={inch} onChange={setInch} suffix="in" />
                </div>
              </div>
            )}
          </Field>
          <Field label="Waist measurement" hint="Optional. Measure at the belly button, relaxed.">
            <NumberInput value={waist} onChange={setWaist} suffix={waistUnit(units)} step={0.1} />
          </Field>
          <div className="row" style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button className="grow" size="lg" disabled={!bodyValid} onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack" style={{ gap: 16 }}>
          <h1 className="big-title">What do you have at home?</h1>
          <p className="muted">Workouts adapt to your equipment. Anything you don’t have gets a dumbbell or bodyweight alternative.</p>
          <div className="check-list">
            {ALL_EQUIPMENT.map((e) => {
              const on = equipment.includes(e.id);
              return (
                <button key={e.id} className={`check-item ${on ? 'on' : ''}`} onClick={() => toggle(e.id)} aria-pressed={on}>
                  <span className="box">{on && <Icon name="check" size={16} />}</span>
                  <span>
                    <div className="lbl">{e.label}</div>
                    <div className="hint">{e.hint}</div>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="row">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="grow" size="lg" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="stack" style={{ gap: 16 }}>
          <h1 className="big-title">Your schedule</h1>
          <Field label="Days per week you can train">
            <Segmented
              options={[3, 4, 5, 6].map((d) => ({ value: String(d), label: String(d) }))}
              value={String(days)}
              onChange={(v) => setDays(Number(v))}
            />
            {days < 5 && <div className="notice">Phase 1 schedules five sessions Monday to Friday. Do what you can; any missed day can be picked up from the Workout tab.</div>}
          </Field>
          <Field label="Typical workout length">
            <Segmented
              options={[30, 45, 60].map((d) => ({ value: String(d), label: `${d} min` }))}
              value={String(duration)}
              onChange={(v) => setDuration(Number(v))}
            />
          </Field>
          <div className="card flat">
            <b>Ready.</b>
            <p className="small muted" style={{ marginTop: 4 }}>
              Your 78-week program starts today. Week 1 is about learning the movements with light weights. Progress is measured in months, not days.
            </p>
          </div>
          <div className="row">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button className="grow" size="lg" disabled={saving} onClick={() => void finish()}>
              Start the program
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
