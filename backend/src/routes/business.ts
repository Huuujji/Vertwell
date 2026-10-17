import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { businessError, requirePermission, type BusinessAction } from '../lib/permissions.js';
import { HttpError } from '../lib/http-error.js';

export const businessRouter = Router();

function pagination(query: Record<string, unknown>) {
  if (Object.keys(query).some(key => !['offset','limit'].includes(key))) throw new HttpError(422, 'Unsupported query field.');
  const parse = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) > max) throw new HttpError(422, 'Invalid pagination.');
    return Number(value);
  };
  const page_offset = parse(query.offset, 0, 1_000_000), page_size = parse(query.limit, 50, 100);
  if (!page_size) throw new HttpError(422, 'Invalid pagination.');
  return { page_offset, page_size };
}

businessRouter.get('/access', requireAuth, async (_req, res) => {
  const { data, error } = await res.locals.database.rpc('business_access');
  if (error) businessError(error);
  res.json({ ...data, services: { inventoryCrud: data?.services?.inventoryCrud === true, checkout: false, salesReview: false, reports: false } });
});

for (const path of ['/sales', '/sales/:id']) {
  businessRouter.get(path, requireAuth, requirePermission('sales.read', path.includes(':id') ? 'id' : undefined), async (req, res) => {
    const { data, error } = await res.locals.database.rpc('read_business_sales', {
      target_sale_id: req.params.id ?? null, ...pagination(req.query),
    });
    if (error) businessError(error);
    res.json(data);
  });
}

businessRouter.get('/void-requests', requireAuth, requirePermission('sales.read'), async (req, res) => {
  const { page_offset, page_size } = pagination(req.query);
  const { data, error } = await res.locals.database.from('void_requests').select('*')
    .order('requested_at', { ascending: false }).order('id', { ascending: false })
    .range(page_offset, page_offset + page_size);
  if (error) businessError(error);
  res.json({ items: data.slice(0, page_size), hasMore: data.length > page_size });
});

businessRouter.get('/pos/catalogue', requireAuth, requirePermission('pos.read'), async (req, res) => {
  const { data, error } = await res.locals.database.rpc('read_pos_catalogue', pagination(req.query));
  if (error) businessError(error);
  res.json(data);
});

businessRouter.get('/alert-settings', requireAuth, requirePermission('alerts.read'), async (_req, res) => {
  const { data, error } = await res.locals.database.from('alert_settings').select('*').maybeSingle();
  if (error) businessError(error);
  res.json({ settings: data });
});

businessRouter.patch('/alert-settings', requireAuth, requirePermission('alerts.write'), async (req, res) => {
  const body = req.body as Record<string, unknown> | null;
  if (!body || Array.isArray(body) || typeof body !== 'object' ||
    Object.keys(body).some(key => !['updatedAt','similarOrderThreshold','windowMinutes'].includes(key)) ||
    !(body.updatedAt === null || typeof body.updatedAt === 'string' && Number.isFinite(Date.parse(body.updatedAt))) ||
    !Number.isInteger(body.similarOrderThreshold) || Number(body.similarOrderThreshold) < 2 || Number(body.similarOrderThreshold) > 100 ||
    !Number.isInteger(body.windowMinutes) || Number(body.windowMinutes) < 1 || Number(body.windowMinutes) > 60) {
    throw new HttpError(422, 'Enter the current revision and valid alert thresholds.');
  }
  const { data, error } = await res.locals.database.rpc('update_alert_settings', {
    expected_updated_at: body.updatedAt, similar_order_threshold: body.similarOrderThreshold, window_minutes: body.windowMinutes,
  });
  if (error) businessError(error);
  res.json({ settings: data });
});

// Reserve future command boundaries now. Authorization runs first, including
// sale ownership/day checks, but no unfinished command can change any data.
const pending: [string, string, BusinessAction, string?][] = [
  ['get', '/dashboard', 'dashboard.read'],
  ['post', '/inventory', 'inventory.write'], ['patch', '/inventory/:id', 'inventory.write'],
  ['delete', '/inventory/:id', 'inventory.write'], ['get', '/reports', 'reports.read'],
  ['post', '/checkout', 'checkout.create'], ['post', '/sales/:id/void-requests', 'void.request', 'id'],
  ['post', '/sales/:id/void', 'sale.void', 'id'], ['post', '/sales/:id/void-decision', 'void.decide', 'id'],
  ['post', '/daily-sales-reviews', 'review.confirm'],
];
for (const [method, path, action, target] of pending) {
  const register = method === 'get' ? businessRouter.get.bind(businessRouter) : method === 'patch' ? businessRouter.patch.bind(businessRouter)
    : method === 'delete' ? businessRouter.delete.bind(businessRouter) : businessRouter.post.bind(businessRouter);
  register(path, requireAuth, requirePermission(action, target), () => { throw new HttpError(501, 'This business service is awaiting data integration.'); });
}
