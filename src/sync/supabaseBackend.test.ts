import { describe, expect, it } from 'vitest';
import { supabaseConfigured } from './supabaseBackend';

describe('supabaseConfigured', () => {
  it('is false until supabaseConfig.ts is filled in, so the app stays local-only by default', () => {
    expect(supabaseConfigured()).toBe(false);
  });
});
