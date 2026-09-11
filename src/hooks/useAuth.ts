import { useEffect, useState } from 'react';
import { getSupabase, supabaseConfigured, type Session } from '../sync/supabaseBackend';

export type AuthState = {
  /** false when supabaseConfigured() is false — the app runs local-only, no login required. */
  configured: boolean;
  /** true until the initial session check resolves. */
  loading: boolean;
  session: Session | null;
};

export function useAuth(): AuthState {
  const configured = supabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  return { configured, loading, session };
}
