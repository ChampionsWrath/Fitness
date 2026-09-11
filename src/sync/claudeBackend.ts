import type { SyncBackend, SyncDoc } from './backend';

// Minimal typing of the claude.ai artifact runtime (`window.claude.use`).
interface ClaudeDocSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface ClaudeDocRef {
  get(): Promise<ClaudeDocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
interface ClaudeCollectionRef {
  get(): Promise<{ docs: ClaudeDocSnapshot[] }>;
  doc(id?: string): ClaudeDocRef;
}
interface ClaudeDb {
  doc(path: string): ClaudeDocRef;
  collection(path: string): ClaudeCollectionRef;
}
interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

function runtime(): ClaudeRuntime | null {
  const w = window as unknown as { claude?: ClaudeRuntime };
  return w.claude && typeof w.claude.use === 'function' ? w.claude : null;
}

/** True when the page is running inside a host that could provide capabilities. */
export function hasClaudeRuntime(): boolean {
  return runtime() !== null;
}

/** Resolves the db-backed backend, or null when this view cannot use it. */
export async function createClaudeBackend(): Promise<SyncBackend | null> {
  const rt = runtime();
  if (!rt) return null;
  let db: ClaudeDb | null = null;
  try {
    db = (await rt.use('db')) as ClaudeDb | null;
  } catch {
    db = null;
  }
  if (!db) return null;
  const store = db;
  return {
    name: 'claude.ai',
    async list(collection: string): Promise<Record<string, SyncDoc>> {
      const snap = await store.collection(collection).get();
      const out: Record<string, SyncDoc> = {};
      for (const d of snap.docs) {
        if (!d.exists) continue;
        const data = d.data();
        if (data) out[d.id] = data;
      }
      return out;
    },
    async set(collection: string, id: string, data: SyncDoc): Promise<void> {
      await store.doc(`${collection}/${id}`).set(data);
    },
    async delete(collection: string, id: string): Promise<void> {
      await store.doc(`${collection}/${id}`).delete();
    },
  };
}
