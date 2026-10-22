import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '../config/env.js';
import { HttpError } from './http-error.js';

let authClient: SupabaseClient | undefined;
let adminClient: SupabaseClient | undefined;

// Bound Auth checks/exchanges without imposing a new cancellation policy on
// business SQL commands. A timed-out checkout can have committed; its recovery
// remains the existing exact-operation path.
const authBoundedFetch: typeof fetch = (input, options) => {
  const url = String(input);
  if (!url.includes('/auth/v1/')) return globalThis.fetch(input, options);
  const deadline = AbortSignal.timeout(5000);
  const signal = options?.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  return globalThis.fetch(input, { ...options, signal });
};

export function getSupabaseAdminClient(): SupabaseClient {
  getSupabaseAuthClient();
  if (!env.supabaseSecretKey) throw new HttpError(503, 'Server account provisioning is not configured.');
  adminClient ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return adminClient;
}

export function getSupabaseAuthClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new HttpError(503, 'Supabase is not configured. Set the backend environment variables.');
  }

  authClient ??= createClient(env.supabaseUrl, env.supabasePublishableKey, {
    global: { fetch: authBoundedFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return authClient;
}

// Future database requests should use a client scoped to the caller's token so RLS applies.
// Never attach a user's session to the shared auth verification client above.
export function createUserDatabaseClient(accessToken: string): SupabaseClient {
  getSupabaseAuthClient();
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    global: { fetch: authBoundedFetch, ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
