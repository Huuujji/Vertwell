import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';

export interface AuthProfile { id: string; full_name: string; username: string; role: 'Owner' | 'Admin' | 'Staff'; active: true; updated_at: string }
export interface IdentityResponse { user: { id: string; email?: string }; profile: AuthProfile }
export type AuthState = { status: 'loading' | 'anonymous' | 'recovery' | 'error'; message?: string } | { status: 'authenticated'; identity: IdentityResponse };

export const invalidRecoveryMessage = 'This recovery link is invalid or expired. Request a fresh recovery email from the login page.';

export async function exchangeRecoveryCode(client: SupabaseClient, code: string, flowId?: string) {
  let recoveredToken: string | undefined;
  const { data: listener } = client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') recoveredToken = session?.access_token;
  });
  try {
    const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    // An existing session or a successful sign-in code is not recovery proof.
    // The SDK emits this event only for the verifier created by a reset request.
    if (error || !data.session || recoveredToken !== data.session.access_token) throw new Error(invalidRecoveryMessage);
  } catch {
    throw new Error(invalidRecoveryMessage);
  } finally {
    listener.subscription.unsubscribe();
  }
}

export function decodeIdentity(value: unknown, userId: string): IdentityResponse {
  const identity = value as IdentityResponse | null;
  if (!identity?.user || identity.user.id !== userId || !identity.profile || identity.profile.id !== userId || identity.profile.active !== true ||
    !['Owner','Admin','Staff'].includes(identity.profile.role) || !identity.profile.full_name || !identity.profile.username || !identity.profile.updated_at) throw new Error('The server returned an invalid account profile.');
  return identity;
}

// Auth callbacks return synchronously: awaiting another SDK call inside one can deadlock.
export function observeSession(client: SupabaseClient, lookup: (token: string, signal: AbortSignal) => Promise<unknown>,
  publish: (state: AuthState) => void, recoveryCallback = false) {
  let revision = 0, disposed = false, recovery = recoveryCallback;
  let controller: AbortController | undefined;
  let current: Session | null = null;
  let verifiedId: string | undefined;
  async function reconcile(session: Session | null, event?: AuthChangeEvent) {
    if (disposed) return;
    const ticket = ++revision;
    controller?.abort(); controller = new AbortController();
    current = session;
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') recovery = false;
    if (!session) { verifiedId=undefined; publish(recovery && event !== 'SIGNED_OUT' ? { status: 'error', message: invalidRecoveryMessage } : { status: 'anonymous' }); return; }
    // Background checks keep an authenticated editor mounted.
    if (!recovery && verifiedId!==session.user.id) publish({ status: 'loading' });
    try {
      const identity = decodeIdentity(await lookup(session.access_token, controller.signal), session.user.id);
      if (ticket !== revision || disposed) return;
      verifiedId=session.user.id;
      publish(recovery ? { status: 'recovery' } : { status: 'authenticated', identity });
    } catch (error) {
      if (ticket !== revision || disposed) return;
      publish({ status: 'error', message: error instanceof Error ? error.message : 'Unable to verify your account. Sign in again.' });
    }
  }
  const { data } = client.auth.onAuthStateChange((event, session) => {
    // Queue work after Supabase releases its auth lock.
    queueMicrotask(() => { void reconcile(session, event); });
  });
  // INITIAL_SESSION restores the persisted session after URL exchange and refresh.
  const onFocus = () => { void reconcile(current); };
  window.addEventListener('focus', onFocus);
  window.addEventListener('vertwell:identity', onFocus);
  const timer = window.setInterval(() => { if (current) void reconcile(current); }, 60_000);
  return () => { disposed = true; revision++; controller?.abort(); data.subscription.unsubscribe(); window.removeEventListener('focus', onFocus); window.removeEventListener('vertwell:identity', onFocus); window.clearInterval(timer); };
}
