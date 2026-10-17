import { supabase } from './supabase';
import { createApiClient } from './api-client';

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Configure Supabase before signing in.');
  const request = createApiClient({ baseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').trim() });
  const result = await request<{ session: { access_token: string; refresh_token: string } }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ identifier: email, password }),
  });
  const { data, error } = await supabase.auth.setSession(result.session);
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) throw new Error('Configure Supabase before signing out.');
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function changeRecoveredPassword(password: string) {
  if (!supabase) throw new Error('Configure Supabase before changing a real password.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  // The recovery form unmounts on SIGNED_OUT; carry only this non-secret notice.
  try { sessionStorage.setItem('vertwell-password-updated', '1'); } catch { /* Storage can be disabled. */ }
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
  if (signOutError) throw new Error('Password changed, but session cleanup failed. Use Log out before continuing.');
}
