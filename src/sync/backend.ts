/**
 * Minimal document-store interface the sync engine talks to. A backend
 * stores plain JSON documents under `collection/id`. Implementation:
 * Supabase (`SupabaseBackend`); swap in a different one here if needed later.
 */
export type SyncDoc = Record<string, unknown>;

export interface SyncBackend {
  name: string;
  /** All documents in a collection, keyed by id. */
  list(collection: string): Promise<Record<string, SyncDoc>>;
  set(collection: string, id: string, data: SyncDoc): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
}

/** In-memory backend for tests. */
export class MemoryBackend implements SyncBackend {
  name = 'memory';
  store = new Map<string, SyncDoc>();
  async list(collection: string): Promise<Record<string, SyncDoc>> {
    const out: Record<string, SyncDoc> = {};
    for (const [k, v] of this.store) {
      const [c, id] = k.split('/');
      if (c === collection) out[id] = v;
    }
    return out;
  }
  async set(collection: string, id: string, data: SyncDoc): Promise<void> {
    this.store.set(`${collection}/${id}`, JSON.parse(JSON.stringify(data)));
  }
  async delete(collection: string, id: string): Promise<void> {
    this.store.delete(`${collection}/${id}`);
  }
}
