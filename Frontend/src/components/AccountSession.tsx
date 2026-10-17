import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createApiClient } from '../lib/api-client';
import { exchangeRecoveryCode, invalidRecoveryMessage, observeSession, type AuthState } from '../lib/auth-session';
import { signOut } from '../lib/auth';

// Real identity never enters a sample workspace. Business integration is P4/P5.
export function useAccountSession() {
  const [state, setState] = useState<AuthState>({ status: supabase ? 'loading' : 'anonymous' });
  // Capture once: StrictMode replays effects after the first effect cleans the URL.
  const [entry] = useState(() => ({ callback: window.location.pathname === '/auth/callback',
    params: new URLSearchParams(window.location.search), fragment: new URLSearchParams(window.location.hash.slice(1)) }));
  // StrictMode effect replay must share the same one-time code exchange.
  const recoveryAttempt = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const { callback, params, fragment } = entry;
    if (callback) window.history.replaceState(null, '', '/');
    const hasError = ['error', 'error_description', 'error_code'].some(key => params.has(key) || fragment.has(key));
    const code = params.get('code');
    if (callback && (hasError || !code)) {
      setState({ status: 'error', message: invalidRecoveryMessage });
      return;
    }
    let disposed = false;
    let stop: (() => void) | undefined;
    const start = () => { stop = observeSession(client, async (token, signal) => {
      const request = createApiClient({ baseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').trim(), accessToken: async () => token });
      return request('/api/auth/me', { signal });
    }, setState, callback); };
    if (callback) {
      recoveryAttempt.current ??= exchangeRecoveryCode(client, code!, params.get('sb_flow_id') ?? undefined);
      void recoveryAttempt.current.then(() => { if (!disposed) start(); }, () => {
        if (!disposed) setState({ status: 'error', message: invalidRecoveryMessage });
      });
    } else start();
    return () => { disposed = true; stop?.(); };
  }, [entry]);
  return state;
}

export default function AccountSession({ state }: { state: AuthState }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true); setError('');
    try { await signOut(); window.location.assign('/'); }
    catch { setError('Unable to sign out. Try again.'); setBusy(false); }
  }
  return <main className="account-session"><section className="account-session-card" aria-busy={state.status === 'loading'}>
    <span className="auth-eyebrow">Account access</span>
    <h1>{state.status === 'loading' ? 'Checking your session…' : state.status === 'authenticated' ? `Welcome, ${state.identity.profile.full_name}` : 'Account access unavailable'}</h1>
    {state.status === 'authenticated' ? <><p>Signed in as <strong>{state.identity.profile.role}</strong> · @{state.identity.profile.username}</p><p>{state.identity.user.email}</p><p>Your account is verified. Inventory, sales and team management will open after their permissions and data integration are complete.</p></> : state.status === 'error' ? <p role="alert">{state.message}</p> : <p role="status">Restoring and verifying your account.</p>}
    {error && <p role="alert">{error}</p>}
    {state.status === 'error' && <button onClick={() => window.location.reload()}>Retry</button>}
    <button disabled={busy} onClick={() => { void logout(); }}>{busy ? 'Signing out…' : 'Log out'}</button>
  </section></main>;
}
