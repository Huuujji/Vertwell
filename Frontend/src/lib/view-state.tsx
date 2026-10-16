import { createContext, useContext, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
export const ViewState = createContext<Map<string, unknown> | null>(null);
// Keep page filters during navigation, scoped to the current preview login.
export function useViewState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const store = useContext(ViewState); const [value, setValue] = useState<T>(() => store?.has(key) ? store.get(key) as T : initial); const latest = useRef(value); latest.current = value;
  return [value, update => { const next = typeof update === 'function' ? (update as (value: T) => T)(latest.current) : update; latest.current = next; store?.set(key, next); setValue(next); }];
}
