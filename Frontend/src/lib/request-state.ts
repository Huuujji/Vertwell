import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, requestError } from './api-client';

type ResourceState<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data?: T; error?: ApiError };

// key includes authenticated identity and scope at P3–P5; never retain another user's data.
export function useResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ResourceState<T> & { key: string | null }>({ key: null, status: 'idle' });
  const revision = useRef(0);
  useEffect(() => {
    if (key === null) { setState({ key, status: 'idle' }); return; }
    const controller = new AbortController();
    let current = true; const ticket=++revision.current;
    setState(previous => ({ key, status: 'loading', data: previous.key === key ? previous.data : undefined }));
    Promise.resolve().then(() => load(controller.signal)).then(data => {
      if (current && ticket===revision.current) setState({ key, status: 'ready', data });
    }, cause => {
      if (current && ticket===revision.current) setState(previous => ({ ...previous, status: 'error', error: requestError(cause) }));
    });
    return () => { current = false; controller.abort(); };
  }, [key, load, attempt]);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  const replace=useCallback((data:T)=>{revision.current++;setState({key,status:'ready',data});},[key]);
  const visible: ResourceState<T> = state.key === key ? state : { status: key === null ? 'idle' : 'loading' };
  return { ...visible, reload, replace };
}

type MutationResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };
export function useMutation<I, O>(save: (input: I) => O | Promise<O>) {
  const [state, setState] = useState<{ saving: boolean; error?: ApiError }>({ saving: false });
  const active = useRef<Promise<MutationResult<O>> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function run(input: I): Promise<MutationResult<O>> {
    if (active.current) return active.current;
    setState({ saving: true });
    const pending = Promise.resolve().then(() => save(input)).then(value => {
      if (mounted.current) setState({ saving: false });
      return { ok: true as const, value };
    }, cause => {
      const error = cause instanceof Error && !(cause instanceof ApiError) ? new ApiError(cause.message, 'response') : requestError(cause);
      if (mounted.current) setState({ saving: false, error });
      return { ok: false as const, error };
    }).finally(() => { if (active.current === pending) active.current = null; });
    active.current = pending;
    return pending;
  }
  function reset() { if (!active.current) setState({ saving: false }); }
  return { ...state, run, reset };
}
