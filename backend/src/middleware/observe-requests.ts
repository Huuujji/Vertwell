import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';

export interface OperationalRecord {
  event: 'api.request'; timestamp: string; requestId: string; route: string;
  method: string; status: number; durationMs: number; slow: boolean;
  level: 'info' | 'warn' | 'error'; outcome: 'response' | 'unconfirmed' | 'aborted';
  clientEvent?: string;
}
export interface MonitoringOptions { sink?: (record: OperationalRecord) => void; slowMs?: number }
const known = new Set([
  '/api/health', '/api/health/ready', '/api/operations/client-events',
  '/api/auth/login', '/api/auth/me', '/api/auth/accounts', '/api/access', '/api/dashboard',
  '/api/inventory', '/api/inventory/commands', '/api/inventory/images', '/api/inventory/image-urls',
  '/api/reports', '/api/sales-workflow', '/api/sales-workflow/commands', '/api/daily-sales-reviews',
  '/api/sales', '/api/void-requests', '/api/pos/catalogue', '/api/pos/checkout-catalogue', '/api/pos/image-urls',
  '/api/pos/quote', '/api/pos/stock', '/api/pos/availability', '/api/checkout', '/api/notifications', '/api/alert-settings',
]);
export function operationalRoute(url: string) {
  const path = url.split('?')[0]!.replace(/\/$/, '').toLowerCase();
  if (known.has(path)) return path;
  for (const pattern of [/^\/api\/auth\/accounts\/[a-f0-9-]{36}$/, /^\/api\/inventory\/[a-f0-9-]{36}$/,
    /^\/api\/sales\/[a-f0-9-]{36}(?:\/(?:receipt|void-requests|void|void-decision))?$/, /^\/api\/notifications\/[a-f0-9-]{36}\/read$/]) {
    if (pattern.test(path)) return path.replace(/[a-f0-9-]{36}/, ':id');
  }
  return 'unmatched'; // Never log arbitrary path/query contents.
}
function defaultSink(record: OperationalRecord) {
  const line = JSON.stringify(record);
  if (record.level === 'error') console.error(line);
  else if (record.level === 'warn') console.warn(line);
  else console.info(line);
}
export function observeRequests({ sink = defaultSink, slowMs = 2000 }: MonitoringOptions = {}): RequestHandler {
  return (req, res, next) => {
    const started = performance.now(), requestId = randomUUID(), route = operationalRoute(req.originalUrl);
    // Ignore client-provided request IDs; no caller text enters the record.
    res.setHeader('X-Request-ID', requestId); res.setHeader('Cache-Control', 'no-store');
    let recorded = false;
    const record = (aborted: boolean) => {
      if (recorded) return; recorded = true;
      const durationMs = Math.round(performance.now() - started), slow = durationMs >= slowMs;
      const status = aborted ? 499 : res.statusCode;
      const command = ['POST', 'PATCH', 'DELETE'].includes(req.method) && ![
        '/api/operations/client-events', '/api/pos/quote', '/api/pos/stock', '/api/pos/availability',
        '/api/pos/image-urls', '/api/inventory/image-urls', '/api/auth/login',
      ].includes(route) && route !== 'unmatched';
      // Healthy routine reads are quiet. Errors, slow work, writes and bounded
      // browser signals remain visible across instances in the platform log sink.
      if (status < 400 && !slow && !command && !res.locals.clientEvent && route !== '/api/auth/login') return;
      const output: OperationalRecord = { event: 'api.request', timestamp: new Date().toISOString(), requestId, route,
        method: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method) ? req.method : 'OTHER',
        status, durationMs, slow, level: status >= 500 ? 'error' : status >= 400 || slow || /\.(offline|unconfirmed|unavailable)$/.test(res.locals.clientEvent ?? '') ? 'warn' : 'info',
        outcome: command && (status >= 500 || aborted) ? 'unconfirmed' : aborted ? 'aborted' : 'response',
        ...(res.locals.clientEvent ? { clientEvent: res.locals.clientEvent } : {}),
      };
      // Observability must not prevent or replay business work if its sink fails.
      try { sink(output); } catch { /* Platform logging is best effort. */ }
    };
    res.once('finish', () => record(false)); res.once('close', () => record(!res.writableFinished));
    next();
  };
}
