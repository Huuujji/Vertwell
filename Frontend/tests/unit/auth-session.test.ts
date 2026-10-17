import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { decodeIdentity, observeSession, type AuthState } from '../../src/lib/auth-session';

const profile = (id = 'real-owner') => ({ user: { id, email: 'owner@example.invalid' }, profile: {
  id, full_name: 'Real Owner', username: 'owner', role: 'Owner', active: true, updated_at: '2026-10-17T00:00:00Z',
} });
const session = (id = 'real-owner') => ({ access_token: id, user: { id } } as Session);
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(lookup: (token: string, signal: AbortSignal) => Promise<unknown>, recovery = false) {
  let callback: (event: AuthChangeEvent, session: Session | null) => void;
  let removed = false;
  const fakeWindow = { addEventListener() {}, removeEventListener() {}, setInterval, clearInterval };
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true });
  const client = { auth: { onAuthStateChange(fn: typeof callback) { callback = fn; return { data: { subscription: { unsubscribe() { removed = true; } } } }; } } } as unknown as SupabaseClient;
  const states: AuthState[] = [];
  const stop = observeSession(client, lookup, state => states.push(state), recovery);
  return { states, emit: (event: AuthChangeEvent, value: Session | null) => callback(event, value), stop, removed: () => removed };
}
test('restoration resolves the server profile and logout discards a pending identity response', async () => {
  let finish: (value: unknown) => void;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  try {
    h.emit('INITIAL_SESSION', session()); await flush();
    h.emit('SIGNED_OUT', null); await flush(); finish!(profile()); await flush();
    assert.equal(h.states.at(-1)?.status, 'anonymous');
    assert.equal(h.states.some(state => state.status === 'authenticated'), false);
  } finally { h.stop(); }
  assert.equal(h.removed(), true);
});
test('active restored sessions use real roles, refresh reflects role changes, and access errors close the workspace', async () => {
  let value: unknown = profile(); let failure = false;
  const h = harness(async () => { if (failure) throw new Error('Account inactive'); return value; });
  try {
    h.emit('INITIAL_SESSION', session()); await flush();
    assert.equal(h.states.at(-1)?.status, 'authenticated');
    value = { ...profile(), profile: { ...profile().profile, role: 'Staff' } };
    h.emit('TOKEN_REFRESHED', session()); await flush();
    const current = h.states.at(-1); assert.ok(current?.status === 'authenticated'); assert.equal(current.identity.profile.role, 'Staff');
    failure = true; h.emit('TOKEN_REFRESHED', session()); await flush();
    assert.equal(h.states.at(-1)?.status, 'error');
  } finally { h.stop(); }
});
test('recovery is separate from normal login and an expired callback never opens a workspace', async () => {
  const h = harness(async () => profile(), true);
  try {
    h.emit('INITIAL_SESSION', null); await flush(); assert.equal(h.states.at(-1)?.status, 'error');
    h.emit('PASSWORD_RECOVERY', session()); await flush(); assert.equal(h.states.at(-1)?.status, 'recovery');
    h.emit('SIGNED_OUT', null); await flush(); assert.equal(h.states.at(-1)?.status, 'anonymous');
  } finally { h.stop(); }
});
test('profile decoding rejects cross-account, inactive and unknown-role responses', () => {
  for (const value of [profile('other'), { ...profile(), profile: { ...profile().profile, active: false } },
    { ...profile(), profile: { ...profile().profile, role: 'Superuser' } }]) assert.throws(() => decodeIdentity(value, 'real-owner'), /invalid/);
});
