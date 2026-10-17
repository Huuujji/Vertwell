import { Router, raw } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/require-auth.js';
import { businessError, requirePermission } from '../lib/permissions.js';
import { HttpError } from '../lib/http-error.js';

export const inventoryRouter = Router();
inventoryRouter.get('/inventory', requireAuth, requirePermission('inventory.read'), async (req, res) => {
  if (Object.keys(req.query).length) throw new HttpError(422, 'Inventory reads do not accept scope overrides.');
  const { data, error } = await res.locals.database.rpc('read_inventory');
  if (error) businessError(error);
  res.json(data);
});
inventoryRouter.post('/inventory/commands', requireAuth, requirePermission('inventory.write'), async (req, res) => {
  if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') throw new HttpError(422, 'Inventory command is required.');
  const { data, error } = await res.locals.database.rpc('inventory_command', { command: req.body });
  if (error) businessError(error);
  res.json(data);
});

inventoryRouter.post('/inventory/images', requireAuth, requirePermission('inventory.write'),
  raw({ type: ['image/png','image/jpeg','image/webp'], limit: '2mb' }), async (req, res) => {
    const bytes: unknown = req.body, type = req.get('content-type')?.split(';')[0];
    if (!Buffer.isBuffer(bytes) || bytes.length < 12) throw new HttpError(422, 'Choose a PNG, JPEG or WebP image up to 2 MB.');
    const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    const webp = bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
    const ext = type==='image/png' && png ? 'png' : type==='image/jpeg' && jpeg ? 'jpg' : type==='image/webp' && webp ? 'webp' : null;
    if (!ext) throw new HttpError(422, 'Image contents do not match its format.');
    const path = `${res.locals.user.id}/${randomUUID()}.${ext}`;
    const { error } = await res.locals.database.storage.from('inventory-images').upload(path, bytes, { contentType: type, upsert: false });
    if (error) throw new HttpError(503, 'Image upload failed. Your draft has been kept.');
    res.status(201).json({ path });
  });
inventoryRouter.post('/inventory/image-urls', requireAuth, requirePermission('inventory.read'), async (req, res) => {
  const paths: unknown = req.body?.paths;
  if (Object.keys(req.body ?? {}).some(key=>key!=='paths') || !Array.isArray(paths) || paths.length>100 || paths.some(path=>typeof path!=='string' || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path))) throw new HttpError(422, 'Invalid image paths.');
  if (!paths.length) { res.json({ images: [] }); return; }
  const { data, error } = await res.locals.database.storage.from('inventory-images').createSignedUrls(paths,3600);
  if (error || data?.some((value: { error: unknown })=>value.error)) throw new HttpError(503, 'Inventory images are unavailable.');
  res.json({ images: data });
});
