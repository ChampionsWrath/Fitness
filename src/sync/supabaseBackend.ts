import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { SyncBackend, SyncDoc } from './backend';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseConfig';

export function supabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

let client: SupabaseClient | null = null;

/** The shared Supabase client. Throws if supabaseConfigured() is false — check first. */
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured()) throw new Error('Supabase is not configured');
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export type { Session };

/**
 * Cloud backend backed by one Postgres table (`sync_docs`, see
 * supabase/schema.sql), scoped to the signed-in user by Row Level Security.
 * Document shape matches the old claude.ai artifact backend this replaces:
 * one JSON blob per `collection/id`.
 */
export class SupabaseBackend implements SyncBackend {
  name = 'supabase';
  constructor(private userId: string) {}

  async list(collection: string): Promise<Record<string, SyncDoc>> {
    const { data, error } = await getSupabase().from('sync_docs').select('doc_id, data').eq('user_id', this.userId).eq('collection', collection);
    if (error) throw error;
    const out: Record<string, SyncDoc> = {};
    for (const row of data ?? []) out[row.doc_id as string] = row.data as SyncDoc;
    return out;
  }

  async set(collection: string, id: string, data: SyncDoc): Promise<void> {
    const { error } = await getSupabase()
      .from('sync_docs')
      .upsert({ user_id: this.userId, collection, doc_id: id, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,collection,doc_id' });
    if (error) throw error;
  }

  async delete(collection: string, id: string): Promise<void> {
    const { error } = await getSupabase().from('sync_docs').delete().eq('user_id', this.userId).eq('collection', collection).eq('doc_id', id);
    if (error) throw error;
  }
}
