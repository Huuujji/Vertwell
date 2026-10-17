export type ApiErrorKind = 'network' | 'cancelled' | 'unauthorized' | 'forbidden' | 'validation' | 'conflict' | 'not-found' | 'server' | 'response' | 'unavailable';

export class ApiError extends Error {
  constructor(message: string, public readonly kind: ApiErrorKind, public readonly status?: number,
    public readonly fields: Readonly<Record<string, string>> = {}) {
    super(message);
    this.name = 'ApiError';
  }
}

export function requestError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;
  if (cause instanceof Error && cause.name === 'AbortError') return new ApiError('Request cancelled.', 'cancelled');
  return new ApiError('Unable to reach the server. Your changes have been kept. Try again.', 'network');
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createApiClient({ baseUrl = '', accessToken = async () => null, fetcher = fetch }: {
  baseUrl?: string; accessToken?: () => Promise<string | null>; fetcher?: typeof fetch;
} = {}) {
  const origin = baseUrl.trim().replace(/\/+$/, '');
  return async function request<T>(path: `/api/${string}`, options: RequestInit = {}): Promise<T> {
    // Never forward a session token to a caller-supplied URL or redirected host.
    if (!/^\/api\/[a-zA-Z0-9/_-]+(?:\?[^#\\]*)?$/.test(path)) throw new ApiError('Invalid API path.', 'response');
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      options.signal?.throwIfAborted();
      const token = await accessToken();
      options.signal?.throwIfAborted();
      // Identity comes only from the session provider, never a caller's header.
      headers.delete('Authorization');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      response = await fetcher(`${origin}${path}`, { ...options, headers, cache: 'no-store', redirect: 'error' });
    } catch (cause) { throw requestError(cause); }
    if (response.status === 204 && response.ok) return undefined as T;
    let data: unknown;
    try { data = await response.json(); }
    catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') throw requestError(cause);
      if (response.ok) throw new ApiError('The API returned an unexpected response. Check VITE_API_BASE_URL.', 'response', response.status);
    }
    if (!response.ok) {
      const kind: ApiErrorKind = response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden'
        : response.status === 404 ? 'not-found' : response.status === 409 ? 'conflict'
        : [400, 422].includes(response.status) ? 'validation' : 'server';
      const details = object(data) && object(data.error) ? data.error : {};
      const fields = object(details.fields) ? Object.fromEntries(Object.entries(details.fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {};
      const defaults: Partial<Record<ApiErrorKind, string>> = { unauthorized: 'Your session has expired. Sign in again. Your changes have been kept.',
        forbidden: 'You do not have permission to perform this action.', conflict: 'This record changed or already exists. Review it before trying again.' };
      throw new ApiError(typeof details.message === 'string' ? details.message : defaults[kind] ?? `Request failed (${response.status}).`, kind, response.status, fields);
    }
    return data as T;
  };
}
