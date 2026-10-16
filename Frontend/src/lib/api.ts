import { supabase } from './supabase';

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

export async function apiRequest<T>(path: `/api/${string}`, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The API returned an unexpected response. Check VITE_API_BASE_URL.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? `Request failed (${response.status}).`);
  return data as T;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  supabaseConfigured: boolean;
}

export interface CurrentUserResponse {
  user: { id: string; email?: string };
}

export const getHealth = (signal?: AbortSignal) => apiRequest<HealthResponse>('/api/health', { signal });
export const getCurrentUser = () => apiRequest<CurrentUserResponse>('/api/auth/me');
