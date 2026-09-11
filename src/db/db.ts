import Dexie, { type EntityTable } from 'dexie';
import type { ExerciseSet, FoodEntry, FoodItem, ProgressPhoto, StepEntry, UserProfile, WaistEntry, WeightEntry, WorkoutSession } from '../types';

export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * Local-first database. All tables carry `updatedAt` so a future sync layer
 * can push/pull changes; nothing here depends on the network.
 */
export class TransformDB extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>;
  sessions!: EntityTable<WorkoutSession, 'id'>;
  sets!: EntityTable<ExerciseSet, 'id'>;
  weights!: EntityTable<WeightEntry, 'id'>;
  waists!: EntityTable<WaistEntry, 'id'>;
  photos!: EntityTable<ProgressPhoto, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;
  foods!: EntityTable<FoodItem, 'id'>;
  foodEntries!: EntityTable<FoodEntry, 'id'>;
  steps!: EntityTable<StepEntry, 'id'>;

  constructor() {
    super('transform');
    this.version(1).stores({
      profile: 'id',
      sessions: 'id, date, status, updatedAt',
      sets: 'id, sessionId, exerciseId, date, [exerciseId+date], completed',
      weights: 'id, &date',
      waists: 'id, &date',
      photos: 'id, date, view, [view+date]',
      meta: 'key',
    });
    this.version(2).stores({
      profile: 'id',
      sessions: 'id, date, status, updatedAt',
      sets: 'id, sessionId, exerciseId, date, [exerciseId+date], completed',
      weights: 'id, &date',
      waists: 'id, &date',
      photos: 'id, date, view, [view+date]',
      meta: 'key',
      foods: 'id, name',
      foodEntries: 'id, date, meal, foodId, createdAt',
    });
    this.version(3).stores({
      profile: 'id',
      sessions: 'id, date, status, updatedAt',
      sets: 'id, sessionId, exerciseId, date, [exerciseId+date], completed',
      weights: 'id, &date',
      waists: 'id, &date',
      photos: 'id, date, view, [view+date]',
      meta: 'key',
      foods: 'id, name',
      foodEntries: 'id, date, meal, foodId, createdAt',
      steps: 'id, &date',
    });
  }
}

export const db = new TransformDB();
