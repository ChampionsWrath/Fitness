import Dexie from 'dexie';
import { db } from '../db/db';
import type { SyncBackend, SyncDoc } from './backend';

/**
 * Cloud backup & restore.
 *
 * Every local table is mirrored into a handful of JSON documents:
 * small tables as one document each, large ones bucketed by month.
 * Records merge by `updatedAt` (last writer wins), so a fresh browser
 * restores everything on first open and later edits flow back within
 * a couple of seconds. Photos are not synced (too large for the store).
 */

type Row = { id: string; updatedAt?: number; date?: string };

interface TableSpec {
  bucket: (row: Row) => string; // document id inside the collection
}

const TABLES: Record<string, TableSpec> = {
  profile: { bucket: () => 'me' },
  weights: { bucket: () => 'all' },
  waists: { bucket: () => 'all' },
  steps: { bucket: () => 'all' },
  foods: { bucket: () => 'custom' },
  sessions: { bucket: (r) => month(r.date) },
  sets: { bucket: (r) => month(r.date) },
  foodEntries: { bucket: (r) => month(r.date) },
};

const TABLE_NAMES = Object.keys(TABLES);

function month(date?: string): string {
  return (date ?? '0000-00').slice(0, 7);
}

export type SyncStatus = {
  state: 'off' | 'checking' | 'ready' | 'syncing' | 'error';
  backend?: string;
  /** why the backup is off (no runtime, capability not served) */
  reason?: string;
  /** true once a real write has been confirmed by the store */
  verified?: boolean;
  /** total rows written in this session */
  rowsPushed?: number;
  lastPull?: number;
  lastPush?: number;
  error?: string;
  pending: number;
};

type Listener = (s: SyncStatus) => void;

export class SyncEngine {
  private backend: SyncBackend | null = null;
  private status: SyncStatus = { state: 'off', pending: 0 };
  private listeners = new Set<Listener>();
  private lastPushed = new Map<string, string>(); // "collection/id" -> serialized doc
  private dirty = false;
  private timer: number | null = null;
  private pushing = false;
  private failures = 0;
  private unsubscribe: (() => void) | null = null;
  /** Resolves once the first restore attempt has finished (or been skipped). */
  readonly ready: Promise<void>;
  private resolveReady!: () => void;

  constructor() {
    this.ready = new Promise((r) => (this.resolveReady = r));
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn(this.status);
  }

  /** Attach a backend (or null) and perform the initial restore. */
  async start(backend: SyncBackend | null, offReason = 'Cloud backup not set up'): Promise<void> {
    this.backend = backend;
    if (!backend) {
      this.set({ state: 'off', reason: offReason });
      this.resolveReady();
      return;
    }
    this.set({ state: 'checking', backend: backend.name });
    try {
      await this.pull();
      // Prove that writes actually work before trusting the store with anything.
      await backend.set('meta', 'probe', { ts: Date.now(), ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : '' });
      this.set({ state: 'ready', lastPull: Date.now(), verified: true });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.set({ state: 'error', verified: false, error: [err?.code, err?.message ?? String(e)].filter(Boolean).join(': ') });
    }
    this.resolveReady();
    // Any local mutation schedules a push.
    const onMutated = () => this.schedulePush();
    Dexie.on('storagemutated', onMutated);
    const onVis = () => {
      if (document.visibilityState === 'hidden') void this.flush();
      else if (Date.now() - (this.status.lastPull ?? 0) > 60_000) void this.pullSafely();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', () => void this.flush());
    this.unsubscribe = () => {
      Dexie.on('storagemutated').unsubscribe(onMutated);
      document.removeEventListener('visibilitychange', onVis);
    };
    // Push anything that was created before the backend resolved.
    this.schedulePush();
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.dirty = false;
    this.lastPushed.clear();
  }

  private schedulePush(delayMs?: number) {
    if (!this.backend) return;
    this.dirty = true;
    this.set({ pending: 1 });
    if (this.timer) window.clearTimeout(this.timer);
    const delay = delayMs ?? (this.failures ? Math.min(60_000, 1500 * 2 ** this.failures) : 800);
    this.timer = window.setTimeout(() => void this.flush(), delay);
  }

  /** Push now if anything changed (`force` retries after an error). */
  async flush(force = false): Promise<void> {
    if (!this.backend || this.pushing) return;
    if (force) this.dirty = true;
    if (!this.dirty) return;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.pushing = true;
    this.dirty = false;
    try {
      this.set({ state: 'syncing' });
      await this.push();
      this.failures = 0;
      this.set({ state: 'ready', lastPush: Date.now(), pending: 0, error: undefined });
    } catch (e) {
      this.dirty = true;
      this.failures = Math.min(6, this.failures + 1);
      const err = e as { code?: string; message?: string };
      this.set({ state: 'error', error: [err?.code, err?.message ?? String(e)].filter(Boolean).join(': ') });
    } finally {
      this.pushing = false;
      if (this.dirty) this.schedulePush();
    }
  }

  /** Build every document from the local database and write the ones that changed. */
  async push(): Promise<void> {
    if (!this.backend) return;
    const docs = await this.buildDocs();
    for (const [key, doc] of docs) {
      const json = JSON.stringify(doc);
      if (this.lastPushed.get(key) === json) continue;
      const [collection, id] = key.split('/');
      await this.backend.set(collection, id, JSON.parse(json) as SyncDoc); // plain JSON only: drops undefined
      this.lastPushed.set(key, json);
      this.set({ verified: true, rowsPushed: (this.status.rowsPushed ?? 0) + (typeof doc.count === 'number' ? doc.count : 0) });
    }
    // Documents that no longer have any rows (e.g. a month emptied by deletes).
    for (const key of [...this.lastPushed.keys()]) {
      if (docs.has(key)) continue;
      const [collection, id] = key.split('/');
      await this.backend.delete(collection, id);
      this.lastPushed.delete(key);
    }
  }

  private async buildDocs(): Promise<Map<string, SyncDoc>> {
    const out = new Map<string, SyncDoc>();
    for (const name of TABLE_NAMES) {
      const spec = TABLES[name];
      const rows = (await db.table(name).toArray()) as Row[];
      const buckets = new Map<string, Row[]>();
      for (const r of rows) {
        const b = spec.bucket(r);
        buckets.set(b, [...(buckets.get(b) ?? []), r]);
      }
      for (const [bucket, list] of buckets) {
        list.sort((a, b) => a.id.localeCompare(b.id));
        out.set(`${name}/${bucket}`, { rows: list, count: list.length, updatedAt: Math.max(0, ...list.map((r) => r.updatedAt ?? 0)) });
      }
    }
    return out;
  }

  private async pullSafely() {
    try {
      await this.pull();
      this.set({ lastPull: Date.now() });
    } catch {
      /* keep working locally */
    }
    this.schedulePush();
  }

  /** Local vs backed-up row counts per collection, for the Settings screen. */
  async inspect(): Promise<{ name: string; local: number; remote: number }[]> {
    const out: { name: string; local: number; remote: number }[] = [];
    for (const name of TABLE_NAMES) {
      const local = await db.table(name).count();
      let remote = 0;
      if (this.backend) {
        const docs = await this.backend.list(name);
        for (const d of Object.values(docs)) remote += Array.isArray(d.rows) ? d.rows.length : 0;
      }
      out.push({ name, local, remote });
    }
    return out;
  }

  /** Merge every remote document into the local database (newer `updatedAt` wins). */
  async pull(): Promise<void> {
    if (!this.backend) return;
    {
      for (const name of TABLE_NAMES) {
        const remote = await this.backend.list(name);
        const table = db.table(name);
        for (const [id, doc] of Object.entries(remote)) {
          const rows = Array.isArray(doc.rows) ? (doc.rows as Row[]) : [];
          this.lastPushed.set(`${name}/${id}`, JSON.stringify(doc));
          await db.transaction('rw', table, async () => {
            for (const r of rows) {
              if (!r || typeof r.id !== 'string') continue;
              const local = (await table.get(r.id)) as Row | undefined;
              if (!local || (r.updatedAt ?? 0) > (local.updatedAt ?? 0)) await table.put(r);
            }
          });
        }
      }
    }
  }

  /** Remove every remote document (used by "Reset all data"). */
  async clearRemote(): Promise<void> {
    if (!this.backend) return;
    for (const name of TABLE_NAMES) {
      const remote = await this.backend.list(name);
      for (const id of Object.keys(remote)) await this.backend.delete(name, id);
    }
    this.lastPushed.clear();
  }
}

export const sync = new SyncEngine();
