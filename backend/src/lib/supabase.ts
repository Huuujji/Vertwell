import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '../config/env.js';
import { HttpError } from './http-error.js';

let authClient: SupabaseClient | undefined;
let adminClient: SupabaseClient | undefined;

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
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return authClient;
}

// Future database requests should use a client scoped to the caller's token so RLS applies.
// Never attach a user's session to the shared auth verification client above.
export function createUserDatabaseClient(accessToken: string): SupabaseClient {
  getSupabaseAuthClient();
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
