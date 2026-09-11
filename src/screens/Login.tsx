import { useState } from 'react';
import { Button, Field } from '../components/ui';
import { getSupabase } from '../sync/supabaseBackend';

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signedUp, setSignedUp] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    const supabase = getSupabase();
    const { error: err } =
      mode === 'signin' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (mode === 'signup') setSignedUp(true);
  };

  return (
    <div className="screen no-nav fade-in" style={{ paddingTop: '12vh' }}>
      <div className="stack" style={{ maxWidth: 360, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ marginBottom: 4 }}>Transformation</h1>
          <p className="muted small">Sign in to back up your data to the cloud. Everything still works offline in between.</p>
        </div>

        {signedUp ? (
          <div className="notice">Account created and you're signed in. If your Supabase project requires email confirmation, check your inbox before your data starts syncing.</div>
        ) : (
          <div className="card stack" style={{ gap: 12 }}>
            <Field label="Email">
              <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <div className="notice warn">{error}</div>}
            <Button size="lg" full disabled={busy || !email || password.length < 6} onClick={() => void submit()}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
            <button
              className="tiny muted"
              style={{ textAlign: 'center', textDecoration: 'underline' }}
              onClick={() => {
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                setError('');
              }}
            >
              {mode === 'signin' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
