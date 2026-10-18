import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { businessError, requirePermission, uuid, type BusinessAction } from '../lib/permissions.js';
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
  res.json({ ...data, services: { inventoryCrud: data?.services?.inventoryCrud === true, checkout: data?.services?.checkout === true, salesReview: data?.services?.salesReview === true, reports: data?.services?.reports === true } });
});

businessRouter.get('/reports', requireAuth, requirePermission('reports.read'), async (req,res)=>{
  if(Object.keys(req.query).length)throw new HttpError(422,'Report snapshots do not accept scope or identity overrides.');
  const {data,error}=await res.locals.database.rpc('read_reports');
  if(error)businessError(error);
  res.json(data);
});

businessRouter.get('/sales-workflow', requireAuth, requirePermission('sales.read'), async (req,res)=>{
  const {data,error}=await res.locals.database.rpc('read_sales_workflow',pagination(req.query));
  if(error)businessError(error);
  res.json(data);
});

async function workflowCommand(command:unknown,res:import('express').Response) {
  if(!command || typeof command!=='object' || Array.isArray(command)) throw new HttpError(422,'A sales workflow command is required.');
  const {data,error}=await res.locals.database.rpc('sales_workflow_command',{command});
  if(error)businessError(error);
  res.json(data);
}
businessRouter.post('/sales-workflow/commands',requireAuth,requirePermission('sales.read'),async(req,res)=>{
  await workflowCommand(req.body,res);
});
// SQL repeats current-role and receipt-scope checks under the account lock.
// The preliminary read check allows an already committed void to reconcile.
for(const [path,kind] of [['void-requests','void.request'],['void','sale.void'],['void-decision','void.decide']]) {
  businessRouter.post(`/sales/:id/${path}`,requireAuth,requirePermission('sales.read','id'),async(req,res)=>{
    if(kind!=='void.request'&&res.locals.profile.role==='Staff')throw new HttpError(403,'Business access is not permitted.');
    if(req.body?.kind!==kind || !Array.isArray(req.body.targets) || req.body.targets.length!==1 || req.body.targets[0]?.saleId!==req.params.id)
      throw new HttpError(422,'The command must match this receipt and action.');
    await workflowCommand(req.body,res);
  });
}
businessRouter.post('/daily-sales-reviews',requireAuth,requirePermission('review.confirm'),async(req,res)=>{
  if(req.body?.kind!=='review.confirm')throw new HttpError(422,'A daily review command is required.');
  await workflowCommand(req.body,res);
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

businessRouter.get('/pos/checkout-catalogue', requireAuth, requirePermission('pos.read'), async (req, res) => {
  const { data, error } = await res.locals.database.rpc('read_checkout_catalogue_stock', pagination(req.query));
  if (error) businessError(error);
  res.json(data);
});

businessRouter.post('/pos/image-urls', requireAuth, requirePermission('pos.read'), async (req, res) => {
  const paths:unknown=req.body?.paths;
  if(Object.keys(req.body??{}).some(key=>key!=='paths')||!Array.isArray(paths)||paths.length>100||paths.some(path=>typeof path!=='string'||!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path)))throw new HttpError(422,'Invalid image paths.');
  if(!paths.length){res.json({images:[]});return;}
  const {data,error}=await res.locals.database.storage.from('inventory-images').createSignedUrls(paths,3600);
  if(error||data?.some((value:{error:unknown})=>value.error))throw new HttpError(503,'Product images are unavailable.');
  res.json({images:data});
});

businessRouter.get('/sales/:id/receipt', requireAuth, requirePermission('sales.read','id'), async (req,res)=>{
  if(Object.keys(req.query).length)throw new HttpError(422,'Receipt reads do not accept scope overrides.');
  const {data,error}=await res.locals.database.rpc('read_checkout_receipt',{target_sale_id:req.params.id});
  if(error)businessError(error);res.json(data);
});

businessRouter.post('/pos/quote', requireAuth, requirePermission('checkout.create'), async (req, res) => {
  if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object' ||
    Object.keys(req.body).some(key => key !== 'lines') || !Array.isArray(req.body.lines)) {
    throw new HttpError(422, 'A cart is required for a quote.');
  }
  const { data, error } = await res.locals.database.rpc('quote_checkout', { lines: req.body.lines });
  if (error) businessError(error);
  res.json(data);
});

businessRouter.post('/pos/stock', requireAuth, requirePermission('checkout.create'), async (req,res)=>{
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(key=>key!=='lines')||!Array.isArray(req.body.lines))throw new HttpError(422,'A cart is required for stock feedback.');
  const {data,error}=await res.locals.database.rpc('read_checkout_stock',{lines:req.body.lines});
  if(error)businessError(error);res.json(data);
});

businessRouter.post('/pos/availability', requireAuth, requirePermission('checkout.create'), async (req,res)=>{
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(key=>!['productId','lines'].includes(key))||!Array.isArray(req.body.lines))throw new HttpError(422,'A product and current cart are required.');
  const {data,error}=await res.locals.database.rpc('check_checkout_product',{product_id:uuid(req.body.productId),lines:req.body.lines});
  if(error)businessError(error);res.json(data);
});

businessRouter.post('/checkout', requireAuth, requirePermission('checkout.create'), async (req, res) => {
  if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') throw new HttpError(422, 'A checkout command is required.');
  const { data, error } = await res.locals.database.rpc('checkout', { command: req.body });
  if (error) businessError(error);
  res.json(data);
});

businessRouter.get('/notifications', requireAuth, requirePermission('dashboard.read'), async (req,res) => {
  const {data,error}=await res.locals.database.rpc('read_notifications',pagination(req.query));
  if(error)businessError(error);
  res.json(data);
});
businessRouter.patch('/notifications/:id/read', requireAuth, requirePermission('dashboard.read'), async (req,res) => {
  const body=req.body;
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(key=>!['revision','read'].includes(key))||
    typeof body.revision!=='string'||!/^[1-9][0-9]{0,18}$/.test(body.revision)||typeof body.read!=='boolean')
    throw new HttpError(422,'Enter the current notification revision and read state.');
  const {data,error}=await res.locals.database.rpc('set_notification_read',{
    notification_id:uuid(req.params.id),expected_revision:body.revision,is_read:body.read,
  });
  if(error)businessError(error);
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
  ['delete', '/inventory/:id', 'inventory.write'],
];
for (const [method, path, action, target] of pending) {
  const register = method === 'get' ? businessRouter.get.bind(businessRouter) : method === 'patch' ? businessRouter.patch.bind(businessRouter)
    : method === 'delete' ? businessRouter.delete.bind(businessRouter) : businessRouter.post.bind(businessRouter);
  register(path, requireAuth, requirePermission(action, target), () => { throw new HttpError(501, 'This business service is awaiting data integration.'); });
}
