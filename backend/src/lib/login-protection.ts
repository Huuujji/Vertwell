import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from './http-error.js';
import { getSupabaseAdminClient } from './supabase.js';

const unavailable = () => new HttpError(503, 'Login protection is unavailable. Try again shortly.');

// Canonical IPv4, including mapped addresses; IPv6 uses /64 so rotating the
// interface portion cannot create a fresh budget. Ports, zones and lists fail.
export function loginNetwork(address: string | undefined): string {
  if (!address || !isIP(address) || address.includes('%')) throw unavailable();
  if (isIP(address) === 4) return address;
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const start = left ? left.split(':') : [];
  const end = right ? right.split(':') : [];
  const groups = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill('0'), ...end];
  const words = groups.map(group => parseInt(group, 16));
  if (words.slice(0, 5).every(word => word === 0) && words[5] === 0xffff) {
    return [words[6]! >> 8, words[6]! & 255, words[7]! >> 8, words[7]! & 255].join('.');
  }
  return `${words.slice(0, 4).map(word => word.toString(16).padStart(4, '0')).join(':')}::/64`;
}

export function loginClientNetwork(req: Pick<Request, 'headers' | 'socket'>, vercel: boolean): string {
  // Only the Vercel runtime may use its overwritten platform header. Express
  // trust proxy stays off. Other forwarded headers never supply this identity.
  const address = vercel ? req.headers['x-vercel-forwarded-for'] : req.socket.remoteAddress;
  if (typeof address !== 'string') throw unavailable();
  return loginNetwork(address);
}

export function createLoginProtection(): RequestHandler {
  // Development-only fallback is owned by this app, never a deployed instance.
  const attempts = new Map<string, { count: number; until: number }>();
  return async (req, res, next) => {
    const deployed = env.vercel || env.production;
    const mode = env.loginRateLimitMode || (deployed ? 'shared' : 'memory');
    if (!['shared', 'memory'].includes(mode) || (deployed && mode !== 'shared')) throw unavailable();
    const network = loginClientNetwork(req, env.vercel);
    let allowed: boolean;
    let retryAfter: number;
    if (mode === 'shared') {
      if (!env.supabaseSecretKey) throw unavailable();
      // Stable across instances/releases sharing this backend key. Rotating it
      // starts fresh budgets. Only the digest goes to the operational counter.
      const clientKey = createHmac('sha256', env.supabaseSecretKey).update(`vertwell:login:v1:${network}`).digest('hex');
      try {
        const { data, error } = await getSupabaseAdminClient().rpc('consume_login_attempt', { client_key: clientKey })
          .abortSignal(AbortSignal.timeout(3_000));
        if (error || typeof data?.allowed !== 'boolean' || !Number.isInteger(data?.retryAfter) || data.retryAfter < 1 || data.retryAfter > 60) throw unavailable();
        ({ allowed, retryAfter } = data);
      } catch { throw unavailable(); } // Never fall back to per-process counters.
    } else {
      const now = Date.now();
      for (const [key, counter] of attempts) if (counter.until <= now) attempts.delete(key);
      let counter = attempts.get(network);
      if (!counter) {
        if (attempts.size >= 10_000) throw unavailable();
        counter = { count: 0, until: now + 60_000 };
        attempts.set(network, counter);
      }
      allowed = ++counter.count <= 10;
      retryAfter = Math.max(1, Math.ceil((counter.until - now) / 1000));
    }
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfter));
      throw new HttpError(429, 'Too many login attempts. Try again in a minute.');
    }
    next();
  };
}
