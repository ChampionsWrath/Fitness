// ---------------------------------------------------------------------------
// Core data models. Every persisted record carries an `id` string and an
// `updatedAt` timestamp so a future cloud-sync layer can do last-write-wins
// merges without changing the schema.
// ---------------------------------------------------------------------------

export type Unit = 'lb' | 'kg';

export type Equipment =
  | 'dumbbells'
  | 'treadmill'
  | 'bench'
  | 'incline-bench'
  | 'pullup-bar'
  | 'cable-machine'
  | 'resistance-band';

export const ALL_EQUIPMENT: { id: Equipment; label: string; hint: string }[] = [
  { id: 'dumbbells', label: 'Dumbbells', hint: 'Adjustable or a small set' },
  { id: 'treadmill', label: 'Treadmill', hint: 'Used for every cardio session' },
  { id: 'bench', label: 'Flat bench', hint: 'Sturdy bench for pressing' },
  { id: 'incline-bench', label: 'Adjustable / incline bench', hint: 'Can be set to an angle' },
  { id: 'pullup-bar', label: 'Pull-up bar', hint: 'Doorway or mounted' },
  { id: 'cable-machine', label: 'Cable machine / lat pulldown', hint: 'Gym-style machine' },
  { id: 'resistance-band', label: 'Resistance bands', hint: 'Loop or handle bands' },
];

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UserProfile {
  id: 'me';
  name?: string;
  units: Unit;
  heightCm?: number;
  startWeight: number; // in `units`
  goalWeight: number;
  startWaist?: number; // inches when units=lb, cm when units=kg
  equipment: Equipment[];
  daysPerWeek: number;
  typicalDurationMin: number;
  programStartDate: string; // ISO date yyyy-mm-dd (local)
  theme: ThemePreference;
  defaultRestSeconds: number;
  onboardingComplete: boolean;
  disclaimerAccepted: boolean;
  nutrition?: NutritionSettings;
  createdAt: number;
  updatedAt: number;
}

export type ExerciseKind = 'strength' | 'timed';
export type Difficulty = 'beginner' | 'easy' | 'moderate';
export type MuscleGroup =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'lats'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'heart & lungs'
  | 'full body';

export interface Exercise {
  id: string;
  name: string;
  /** One plain-English sentence for people who have never heard of it. */
  plainName: string;
  kind: ExerciseKind;
  figure: string; // key into the figure/animation registry
  equipment: Equipment[]; // ALL required
  alternatives: string[]; // exercise ids, most preferred first
  difficulty: Difficulty;
  muscles: MuscleGroup[];
  startingPosition: string;
  movement: string[];
  commonMistakes: string[];
  beginnerTips: string[];
  safety?: string;
  lowerBack?: boolean; // emphasise neutral spine
  beginnerWeight: string;
  /** Default weight (in lb) to prefill on the very first session. 0 = bodyweight. */
  defaultWeightLb: number;
  restSeconds: number;
  /** Metabolic equivalent while performing sets (default 3.5). */
  met?: number;
}

export interface SetPrescription {
  sets: number;
  repMin: number;
  repMax: number;
  perSide?: boolean;
}

export type Intensity = 'easy' | 'moderate' | 'hard' | 'rest';

export interface Interval {
  label: string; // "Easy walk", "Brisk walk / jog"
  seconds: number;
  intensity: Intensity;
  exerciseId?: string; // for circuits: the movement to perform
  cue?: string;
}

export interface TimedBlock {
  id: string;
  title: string;
  description: string;
  intervals: Interval[];
}

export type WorkoutItem =
  | { type: 'strength'; exerciseId: string; prescription: SetPrescription }
  | { type: 'timed'; exerciseId: string; blockId: string };


export type WorkoutType =
  | 'upper-a'
  | 'lower'
  | 'conditioning'
  | 'upper-b'
  | 'full-body'
  | 'optional'
  | 'rest'
  | 'upper'
  | 'lower-2';

export interface WorkoutPlan {
  id: string;
  type: WorkoutType;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  items: WorkoutItem[];
}

export interface Phase {
  id: 1 | 2 | 3;
  name: string;
  monthsLabel: string;
  startWeek: number; // inclusive, 1-based
  endWeek: number; // inclusive
  description: string;
  focus: string[];
  /** weekday (0=Sunday) -> plan id */
  schedule: Record<number, string>;
  configured: boolean;
}

export type SessionStatus = 'in-progress' | 'completed' | 'abandoned';

/** What the treadmill display showed for a cardio block. Distance in the profile's unit (mi or km). */
export interface CardioLog {
  distance: number;
  incline: number; // percent grade
  minutes: number;
  kcal: number;
}

export interface SessionExercise {
  exerciseId: string;
  /** exercise this replaced because of missing equipment, if any */
  substitutedFor?: string;
  prescription?: SetPrescription;
  blockId?: string;
  completed: boolean;
  cardio?: CardioLog;
}

export interface WorkoutSession {
  id: string;
  date: string; // yyyy-mm-dd (local)
  workoutType: WorkoutType;
  planId: string;
  title: string;
  phase: number;
  week: number;
  startTime: number;
  endTime?: number;
  status: SessionStatus;
  exercises: SessionExercise[];
  completedExercises: string[];
  notes?: string;
  /** estimated calories burned, net of resting: lifting + cardio */
  caloriesBurned?: number;
  burnLifting?: number;
  burnCardio?: number;
  updatedAt: number;
}

export interface ExerciseSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  date: string;
  setNumber: number;
  weight: number; // in profile units; 0 for bodyweight
  reps: number;
  duration?: number; // seconds, for timed work
  completed: boolean;
  completedAt?: number;
  updatedAt: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  updatedAt: number;
}

export interface WaistEntry {
  id: string;
  date: string;
  waist: number;
  updatedAt: number;
}

export type PhotoView = 'front' | 'side' | 'back';

export interface ProgressPhoto {
  id: string;
  date: string;
  view: PhotoView;
  blob: Blob;
  width: number;
  height: number;
  updatedAt: number;
}

export interface TimerState {
  kind: 'rest' | 'interval';
  endsAt: number;
  totalSeconds: number;
  label?: string;
}

// ---------------------------------------------------------------- nutrition
export type Sex = 'male' | 'female' | 'unspecified';
export type ActivityLevel = 'desk' | 'onfeet' | 'physical';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Macros {
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber?: number; // g
}

export interface Serving {
  label: string; // "1 breast", "1 cup", "1 slice"
  grams: number;
}

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  category: string;
  per100g: Macros;
  servings: Serving[];
  custom?: boolean;
  updatedAt?: number;
}

export interface FoodEntry {
  id: string;
  date: string; // yyyy-mm-dd
  meal: MealType;
  foodId?: string;
  name: string;
  quantity: number; // number of servings
  servingLabel: string;
  grams: number; // total grams eaten
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  createdAt: number;
  updatedAt: number;
}

export interface StepEntry {
  id: string;
  date: string;
  steps: number;
  updatedAt: number;
}

export interface NutritionSettings {
  sex: Sex;
  age: number;
  activity: ActivityLevel;
  /** desired loss per week in profile units (lb or kg); 0 = maintain */
  pace: number;
  /** manual overrides; when set they win over the computed values */
  calorieOverride?: number;
  proteinOverride?: number;
  /** add calories burned by steps above the activity baseline to the day's budget (default true) */
  countSteps?: boolean;
  updatedAt: number;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  deficit: number;
  floored: boolean;
}
