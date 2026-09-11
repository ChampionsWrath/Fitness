import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { FOOD_MAP, searchFoods } from '../data/foods';
import { addFoodEntry, listCustomFoods, recentFoods, saveCustomFood, updateFoodEntry } from '../db/repo';
import { newId } from '../lib/ids';
import { MEALS, macrosFor, servingOptions } from '../lib/nutrition';
import type { FoodEntry, FoodItem, MealType, Serving, Unit } from '../types';
import { Button, Field, Icon, NumberInput, Segmented, Sheet } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  meal: MealType;
  units: Unit;
  /** when set, the sheet edits this entry instead of adding one */
  editing?: FoodEntry | null;
}

export function FoodSearch({ open, onClose, date, meal: initialMeal, units, editing }: Props) {
  const [q, setQ] = useState('');
  const [food, setFood] = useState<FoodItem | null>(null);
  const [creating, setCreating] = useState(false);
  const custom = useLiveQuery(listCustomFoods, []) ?? [];
  const recents = useLiveQuery(() => recentFoods(10), []) ?? [];

  useEffect(() => {
    if (!open) return;
    setQ('');
    setCreating(false);
    if (editing) {
      const f = (editing.foodId && (FOOD_MAP[editing.foodId] ?? custom.find((c) => c.id === editing.foodId))) || entryAsFood(editing);
      setFood(f);
    } else setFood(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const results = useMemo(() => searchFoods(q, custom), [q, custom]);
  const recentItems = useMemo(
    () =>
      recents
        .map((r) => (r.foodId && (FOOD_MAP[r.foodId] ?? custom.find((c) => c.id === r.foodId))) || entryAsFood(r))
        .filter((f): f is FoodItem => !!f),
    [recents, custom],
  );

  return (
    <Sheet open={open} onClose={onClose} full>
      {food ? (
        <QuantityStep food={food} units={units} date={date} meal={initialMeal} editing={editing} onBack={() => (editing ? onClose() : setFood(null))} onDone={onClose} />
      ) : creating ? (
        <CreateFood
          units={units}
          initialName={q}
          onCancel={() => setCreating(false)}
          onCreated={(f) => {
            setCreating(false);
            setFood(f);
          }}
        />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row">
            <input
              className="input grow"
              type="search"
              placeholder="Search foods (e.g. chicken, big mac, oatmeal)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              aria-label="Search foods"
            />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
          {!q && recentItems.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                Recent
              </div>
              {recentItems.map((f) => (
                <ResultRow key={`r-${f.id}`} food={f} onPick={() => setFood(f)} />
              ))}
            </div>
          )}
          <div>
            {q && (
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                {results.length ? `${results.length} results` : 'No matches'}
              </div>
            )}
            {!q && (
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                All foods
              </div>
            )}
            {results.map((f) => (
              <ResultRow key={f.id} food={f} onPick={() => setFood(f)} />
            ))}
          </div>
          <Button variant="secondary" full onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} /> Create a food from a label
          </Button>
          <p className="tiny muted">Values come from a built-in database of common foods (USDA and typical labels). For packaged food, creating it from the label is the most accurate.</p>
        </div>
      )}
    </Sheet>
  );
}

function entryAsFood(e: FoodEntry): FoodItem | null {
  if (!e.grams) return null;
  const f = 100 / e.grams;
  return {
    id: `entry-${e.id}`,
    name: e.name,
    category: 'Custom',
    per100g: { kcal: e.kcal * f, protein: e.protein * f, carbs: e.carbs * f, fat: e.fat * f, fiber: e.fiber != null ? e.fiber * f : undefined },
    servings: [{ label: e.servingLabel, grams: e.grams / (e.quantity || 1) }],
    custom: true,
  };
}

function ResultRow({ food, onPick }: { food: FoodItem; onPick: () => void }) {
  const first = food.servings[0];
  const m = macrosFor(food, first.grams);
  return (
    <button className="food-result" onClick={onPick}>
      <div className="grow">
        <div className="nm">
          {food.name}
          {food.brand && <span className="muted"> · {food.brand}</span>}
        </div>
        <div className="sub">
          {first.label} · P {Math.round(m.protein)}g · C {Math.round(m.carbs)}g · F {Math.round(m.fat)}g
          {food.custom && ' · custom'}
        </div>
      </div>
      <div className="kc">{m.kcal} kcal</div>
    </button>
  );
}

function QuantityStep({
  food,
  units,
  date,
  meal: initialMeal,
  editing,
  onBack,
  onDone,
}: {
  food: FoodItem;
  units: Unit;
  date: string;
  meal: MealType;
  editing?: FoodEntry | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const options = servingOptions(food, units);
  const [serving, setServing] = useState<Serving>(() => options.find((o) => o.label === editing?.servingLabel) ?? options[0]);
  const [qty, setQty] = useState<number | ''>(editing?.quantity ?? 1);
  const [meal, setMeal] = useState<MealType>(editing?.meal ?? initialMeal);
  const grams = serving.grams * (Number(qty) || 0);
  const m = macrosFor(food, grams);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!grams) return;
    setSaving(true);
    const base = {
      date: editing?.date ?? date,
      meal,
      foodId: food.id.startsWith('entry-') ? undefined : food.id,
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      quantity: Number(qty),
      servingLabel: serving.label,
      grams: Math.round(grams * 10) / 10,
      ...m,
    };
    if (editing) await updateFoodEntry({ ...editing, ...base });
    else await addFoodEntry(base);
    onDone();
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="grow">
          <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{food.name}</div>
          {food.brand && <div className="small muted">{food.brand}</div>}
        </div>
      </div>
      <div className="macro-preview" aria-live="polite">
        <div>
          <b>{m.kcal}</b>
          <span>kcal</span>
        </div>
        <div>
          <b>{Math.round(m.protein)}</b>
          <span>Protein</span>
        </div>
        <div>
          <b>{Math.round(m.carbs)}</b>
          <span>Carbs</span>
        </div>
        <div>
          <b>{Math.round(m.fat)}</b>
          <span>Fat</span>
        </div>
      </div>
      <Field label="Serving">
        <div className="chips">
          {options.map((o) => (
            <button key={o.label} className={`chip ${o.label === serving.label ? 'on' : ''}`} onClick={() => setServing(o)}>
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="How many">
        <div className="qty-row">
          <button onClick={() => setQty((v) => Math.max(0.25, Math.round(((Number(v) || 1) - 0.5) * 100) / 100))} aria-label="Less">
            <Icon name="minus" />
          </button>
          <input className="input num" type="number" inputMode="decimal" step={0.25} min={0} value={qty} onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))} aria-label="Quantity" />
          <button onClick={() => setQty((v) => Math.round(((Number(v) || 0) + 0.5) * 100) / 100)} aria-label="More">
            <Icon name="plus" />
          </button>
        </div>
        <div className="tiny muted">= {Math.round(grams)} g total</div>
      </Field>
      <Field label="Meal">
        <Segmented options={MEALS.map((x) => ({ value: x.id, label: x.label }))} value={meal} onChange={setMeal} />
      </Field>
      <Button size="lg" full disabled={!grams || saving} onClick={() => void save()}>
        {editing ? 'Save changes' : `Add ${m.kcal} kcal`}
      </Button>
    </div>
  );
}

function CreateFood({ units, initialName, onCancel, onCreated }: { units: Unit; initialName: string; onCancel: () => void; onCreated: (f: FoodItem) => void }) {
  const [name, setName] = useState(initialName);
  const [servingLabel, setServingLabel] = useState('1 serving');
  const [servingGrams, setServingGrams] = useState<number | ''>('');
  const [kcal, setKcal] = useState<number | ''>('');
  const [protein, setProtein] = useState<number | ''>('');
  const [carbs, setCarbs] = useState<number | ''>('');
  const [fat, setFat] = useState<number | ''>('');
  const valid = name.trim() && kcal !== '';
  const create = async () => {
    const grams = Number(servingGrams) || 100;
    const f = 100 / grams;
    const food: FoodItem = {
      id: `custom-${newId()}`,
      name: name.trim(),
      category: 'Custom',
      per100g: { kcal: Number(kcal) * f, protein: (Number(protein) || 0) * f, carbs: (Number(carbs) || 0) * f, fat: (Number(fat) || 0) * f },
      servings: [{ label: servingLabel.trim() || '1 serving', grams }],
      custom: true,
    };
    await saveCustomFood(food);
    onCreated(food);
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row">
        <button className="icon-btn" onClick={onCancel} aria-label="Back">
          <Icon name="back" />
        </button>
        <h2 style={{ margin: 0 }}>New food</h2>
      </div>
      <p className="small muted">Copy the numbers for one serving straight from the nutrition label.</p>
      <Field label="Name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kirkland protein bar" />
      </Field>
      <div className="row">
        <Field label="Serving name">
          <input className="input" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="1 bar" />
        </Field>
        <Field label="Serving weight" hint="Optional">
          <NumberInput value={servingGrams} onChange={setServingGrams} suffix="g" />
        </Field>
      </div>
      <Field label="Calories per serving">
        <NumberInput value={kcal} onChange={setKcal} suffix="kcal" />
      </Field>
      <div className="row">
        <Field label="Protein">
          <NumberInput value={protein} onChange={setProtein} suffix="g" />
        </Field>
        <Field label="Carbs">
          <NumberInput value={carbs} onChange={setCarbs} suffix="g" />
        </Field>
        <Field label="Fat">
          <NumberInput value={fat} onChange={setFat} suffix="g" />
        </Field>
      </div>
      <Button size="lg" full disabled={!valid} onClick={() => void create()}>
        Save and add
      </Button>
      <p className="tiny muted">Units shown in {units === 'lb' ? 'ounces and grams' : 'grams'} when logging.</p>
    </div>
  );
}
