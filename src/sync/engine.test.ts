import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { addFoodEntry, defaultProfile, saveProfile, upsertWeight } from '../db/repo';
import { MemoryBackend } from './backend';
import { SyncEngine } from './engine';

async function wipeLocal() {
  await db.delete();
  await db.open();
}

describe('SyncEngine', () => {
  beforeEach(wipeLocal);

  it('pushes local data as documents and restores it into an empty database', async () => {
    const backend = new MemoryBackend();
    const engine = new SyncEngine();
    await engine.start(backend);
    await saveProfile({ ...defaultProfile(), startWeight: 220, goalWeight: 180, onboardingComplete: true });
    await upsertWeight('2026-09-07', 219.4);
    await addFoodEntry({ date: '2026-09-07', meal: 'lunch', name: 'Banana', quantity: 1, servingLabel: '1 medium', grams: 118, kcal: 105, protein: 1, carbs: 27, fat: 0 });
    await engine.push();
    expect(Object.keys(await backend.list('profile'))).toEqual(['me']);
    expect((await backend.list('foodEntries'))['2026-09'].count).toBe(1);
    engine.stop();

    await wipeLocal();
    expect(await db.profile.get('me')).toBeUndefined();
    const fresh = new SyncEngine();
    await fresh.start(backend);
    const p = await db.profile.get('me');
    expect(p?.startWeight).toBe(220);
    expect(p?.onboardingComplete).toBe(true);
    expect((await db.weights.toArray())[0].weight).toBe(219.4);
    expect((await db.foodEntries.toArray())[0].name).toBe('Banana');
    fresh.stop();
  });

  it('keeps the newer record when both sides changed', async () => {
    const backend = new MemoryBackend();
    const engine = new SyncEngine();
    await engine.start(backend);
    await saveProfile({ ...defaultProfile(), startWeight: 200, goalWeight: 180, onboardingComplete: true });
    await engine.push();
    // remote gets a newer profile
    const remote = (await backend.list('profile')).me;
    const rows = remote.rows as { startWeight: number; updatedAt: number }[];
    rows[0] = { ...rows[0], startWeight: 210, updatedAt: Date.now() + 10_000 };
    await backend.set('profile', 'me', { ...remote, rows });
    await engine.pull();
    expect((await db.profile.get('me'))?.startWeight).toBe(210);
    // local older change must not override a newer remote
    engine.stop();
  });

  it('does not lose a write that happens while a pull is running', async () => {
    const backend = new MemoryBackend();
    const slow = { ...backend, name: 'slow', list: async (c: string) => new Promise<Record<string, Record<string, unknown>>>((r) => setTimeout(() => void backend.list(c).then(r), 30)), set: backend.set.bind(backend), delete: backend.delete.bind(backend) };
    const engine = new SyncEngine();
    await engine.start(slow);
    const pulling = engine.pull();
    await upsertWeight('2026-09-09', 218);
    await pulling;
    await new Promise((r) => setTimeout(r, 1200));
    expect(Object.keys(await backend.list('weights'))).toEqual(['all']);
    engine.stop();
  });

  it('drops emptied documents and clears remote on reset', async () => {
    const backend = new MemoryBackend();
    const engine = new SyncEngine();
    await engine.start(backend);
    await upsertWeight('2026-09-07', 219.4);
    await engine.push();
    expect(Object.keys(await backend.list('weights'))).toEqual(['all']);
    await db.weights.clear();
    await engine.push();
    expect(Object.keys(await backend.list('weights'))).toEqual([]);
    await upsertWeight('2026-09-08', 219);
    await engine.push();
    await engine.clearRemote();
    expect(Object.keys(await backend.list('weights'))).toEqual([]);
    engine.stop();
  });
});
