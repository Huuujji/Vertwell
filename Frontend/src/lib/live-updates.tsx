import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { AuthProfile } from './auth-session';
import { useResource } from './request-state';

export type DataScope = 'inventory' | 'accounts' | 'catalogue' | 'sales' | 'reports' | 'access' | 'notifications';
type Listener = (scopes: readonly DataScope[]) => void;
const all: DataScope[] = ['inventory','accounts','catalogue','sales','reports','access','notifications'];
const Updates = createContext<Set<Listener> | null>(null);
const Connection = createContext<'connecting'|'connected'|'offline'>('connected');
export function LiveConnectionStatus(){
  const state=useContext(Connection);
  return state==='connected'?null:<p className="inventory-editor-note live-connection-status" role="status">{state==='offline'?'Connection interrupted. Saved data will update automatically when reconnected.':'Connecting automatic updates…'}</p>;
}

// Messages are invalidations only. Every reload still uses the caller-scoped API.
export function LiveUpdates({ profile, children }: { profile: AuthProfile; children: ReactNode }) {
  const [listeners] = useState(() => new Set<Listener>());
  const [state,setState] = useState<'connecting'|'connected'|'offline'>('connecting');
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<DataScope>();
    const invalidate = (scopes: readonly DataScope[]) => {
      scopes.forEach(scope => pending.add(scope));
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (disposed) return;
        const scopes = [...pending]; pending.clear();
        listeners.forEach(listener => listener(scopes));
      },100);
    };
    const topics = [`vertwell:user:${profile.id}`, 'vertwell:catalogue',
      ...(profile.role === 'Staff' ? [] : ['vertwell:managers'])];
    const connected = new Set<string>();
    const channels = topics.map(topic => client.channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'invalidate' }, ({ payload }: { payload: unknown }) => {
        if (disposed || !payload || typeof payload !== 'object') return;
        const value = payload as { scopes?: unknown; identity?: unknown };
        if (value.identity === true) window.dispatchEvent(new Event('vertwell:identity'));
        if (Array.isArray(value.scopes)) invalidate(value.scopes.filter((scope): scope is DataScope => all.includes(scope)));
      }));
    channels.forEach((channel,index) => channel.subscribe(status => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        connected.add(topics[index]);
        // Initial join and every rejoin resynchronize changes missed while disconnected.
        invalidate(all);
        window.dispatchEvent(new Event('vertwell:identity'));
      } else connected.delete(topics[index]);
      setState(connected.size === topics.length ? 'connected' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'offline' : 'connecting');
    }));
    const resume = () => {
      if (document.visibilityState === 'hidden') return;
      invalidate(all); window.dispatchEvent(new Event('vertwell:identity'));
    };
    window.addEventListener('online',resume); window.addEventListener('focus',resume);
    document.addEventListener('visibilitychange',resume);
    return () => {
      disposed = true; if(timer) clearTimeout(timer); pending.clear(); listeners.clear();
      window.removeEventListener('online',resume); window.removeEventListener('focus',resume);
      document.removeEventListener('visibilitychange',resume);
      channels.forEach(channel => { void client.removeChannel(channel); });
    };
  },[profile.id,profile.role,listeners]);
  return <Updates.Provider value={listeners}><Connection.Provider value={state}>{children}</Connection.Provider></Updates.Provider>;
}

// Defer replacement during a draft/save. Its original revision must remain the
// base for conflict detection; an event never retries a business command.
export function useLiveResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, scopes: readonly DataScope[], paused = false) {
  const resource = useResource(key,load,paused);
  const listeners = useContext(Updates);
  const latest = useRef({ paused,scopes,reload:resource.reload });
  latest.current = {paused,scopes,reload:resource.reload};
  const pending = useRef(false);
  useEffect(() => {
    pending.current = false;
    if (!listeners || key === null) return;
    const update: Listener = changed => {
      if (!changed.some(scope => latest.current.scopes.includes(scope))) return;
      if (latest.current.paused) pending.current = true;
      else latest.current.reload();
    };
    listeners.add(update); return () => { listeners.delete(update); };
  },[listeners,key]);
  useEffect(() => {
    if (!paused && pending.current) { pending.current = false; resource.reload(); }
  },[paused,resource.reload]);
  const failures=useRef(0);
  useEffect(()=>{
    if(resource.status==='ready')failures.current=0;
    if(!resource.error||paused)return;
    if(['unauthorized','forbidden'].includes(resource.error.kind)){window.dispatchEvent(new Event('vertwell:identity'));return;}
    const delay=Math.min(30000,1000*2**Math.min(failures.current++,5));
    const timer=setTimeout(resource.reload,delay);return()=>clearTimeout(timer);
  },[resource.error,paused,resource.reload,resource.status]);
  return resource;
}
