import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// A publishable key is intended for browser use. Never use a secret/service-role key here.
if (key && (key.startsWith('sb_secret_') || key.startsWith('eyJ') && (() => {
  try { return JSON.parse(atob(key.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch { return true; }
})())) throw new Error('A privileged Supabase key cannot be used in the browser.');
// The callback hook exchanges recovery codes explicitly and checks the result.
// Automatic URL detection can retain an older session after a failed exchange.
export const supabase = url && key ? createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: false } }) : null;
