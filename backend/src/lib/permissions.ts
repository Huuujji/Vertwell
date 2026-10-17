import type { RequestHandler } from 'express';
import { HttpError } from './http-error.js';
import type { Profile } from './accounts.js';

export type BusinessAction = 'dashboard.read' | 'inventory.read' | 'inventory.write' | 'reports.read' |
  'pos.read' | 'checkout.create' | 'sales.read' | 'void.request' | 'void.decide' | 'sale.void' |
  'review.confirm' | 'accounts.read' | 'accounts.create' | 'accounts.update' | 'alerts.read' | 'alerts.write';

export function businessError(error: { code?: string } | null): never {
  if (error?.code === '42501') throw new HttpError(403, 'Business access is not permitted.');
  if (error?.code === 'PT409' || error?.code === '40001' || error?.code === '23505') throw new HttpError(409, 'The record changed. Reload and review before trying again.');
  if (error?.code?.startsWith('22') || error?.code?.startsWith('23')) throw new HttpError(422, 'Business details are invalid.');
  // Log only the provider's bounded error identifier, never its message/details,
  // request, credentials or caller data. Keep the client response generic.
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,12}$/.test(error.code) ? error.code : 'UNKNOWN';
  console.error(`Business database request failed (${code}).`);
  throw new HttpError(503, 'Business service is unavailable.');
}

export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(422, 'Invalid record ID.');
  return value;
}

// SQL owns the permission matrix and always resolves the current profile. A role
// cached by a browser, middleware, JWT metadata or request body grants nothing.
export function requirePermission(action: BusinessAction, saleParameter?: string): RequestHandler {
  return async (req, res, next) => {
    const target = saleParameter ? uuid(req.params[saleParameter]) : null;
    const { data, error } = await res.locals.database.rpc('authorize_business_action', { action, target_sale_id: target });
    if (error) businessError(error);
    const profile = data?.profile as Profile | undefined;
    if (!profile || profile.id !== res.locals.user.id || profile.active !== true || !['Owner','Admin','Staff'].includes(profile.role)) {
      throw new HttpError(403, 'Business access is not permitted.');
    }
    res.locals.profile = profile;
    next();
  };
}
