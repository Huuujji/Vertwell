import { Router } from 'express';
import { isSupabaseConfigured } from '../config/env.js';
import { requireAuth } from '../middleware/require-auth.js';
import { HttpError } from '../lib/http-error.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'vertwell-api', supabaseConfigured: isSupabaseConfigured });
});

// A private bounded read probe, not a public diagnostic or an end-to-end claim.
// Authentication/current profile have already been queried by requireAuth.
healthRouter.get('/ready', requireAuth, async (req, res) => {
  if (res.locals.profile.role !== 'Owner') throw new HttpError(403, 'Operational checks require an Owner account.');
  if (Object.keys(req.query).length) throw new HttpError(422, 'Operational checks do not accept overrides.');
  async function check(run: (signal: AbortSignal) => PromiseLike<{ error: unknown; data: unknown }>, validate: (data: any) => boolean) {
    try {
      const result = await run(AbortSignal.timeout(3000));
      return !result.error && validate(result.data) ? 'passed' : 'unavailable';
    } catch { return 'unavailable'; }
  }
  const [database, storage] = await Promise.all([
    check(signal => res.locals.database.rpc('business_access').abortSignal(signal), data => data?.profile?.id === res.locals.user.id && data.profile.role === 'Owner' && data.profile.active === true),
    check(signal => res.locals.database.storage.from('inventory-images').list('', { limit: 1 }, { signal }), data => Array.isArray(data)),
  ]);
  const status = database === 'passed' && storage === 'passed' ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({ status, scope: 'read-only-dependency-probe', checks: {
    authentication: 'passed', database, storage,
    privateUpdates: 'requires-client-observation', checkoutReconciliation: 'requires-receipt-review',
  } });
});
