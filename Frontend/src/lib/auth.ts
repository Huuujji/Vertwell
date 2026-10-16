import { supabase } from './supabase';

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Configure Supabase before signing in.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) throw new Error('Configure Supabase before signing out.');
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
