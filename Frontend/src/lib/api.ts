import { supabase } from './supabase';
import { createApiClient } from './api-client';
import type { IdentityResponse } from './auth-session';
export { ApiError } from './api-client';

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

export const apiRequest = createApiClient({ baseUrl, accessToken: async () => {
  if (supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  }
  return null;
} });

export interface HealthResponse {
  status: 'ok';
  service: string;
  supabaseConfigured: boolean;
}

export type CurrentUserResponse = IdentityResponse;

export const getHealth = (signal?: AbortSignal) => apiRequest<HealthResponse>('/api/health', { signal });
// Verified active profile from the server. Business permissions remain P4.
export const getCurrentUser = (signal?: AbortSignal) => apiRequest<CurrentUserResponse>('/api/auth/me', { signal });
