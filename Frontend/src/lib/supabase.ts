import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// A publishable key is intended for browser use. Never use a secret/service-role key here.
export const supabase = url && key ? createClient(url, key) : null;
