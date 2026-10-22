import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { HttpError } from '../lib/http-error.js';

const events = new Set(['updates.offline', 'updates.recovered', 'checkout.unconfirmed', 'checkout.reconciled', 'storage.unavailable']);
// Client observations are explicitly untrusted availability hints, never business
// commands or proof of a database commit. Authentication and strict bounded input
// prevent anonymous arbitrary-log injection. No body/identity is logged.
export function createOperationsRouter() {
  const router = Router();
  const recent = new Map<string, number>();
  router.post('/client-events', requireAuth, (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !events.has(body.event)) {
      throw new HttpError(422, 'Unsupported operational event.');
    }
    const now = Date.now(), key = `${res.locals.profile.id}:${body.event}`;
    for (const [entry, until] of recent) if (until <= now) recent.delete(entry);
    // Best-effort duplicate suppression only, not a cross-instance security limit.
    if (!recent.has(key) && recent.size < 10000) {
      recent.set(key, now + 60000); res.locals.clientEvent = body.event;
    }
    res.status(204).end();
  });
  return router;
}
