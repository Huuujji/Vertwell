import type { User } from '@supabase/supabase-js';
import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { accountInput, currentProfile, databaseError, type Profile } from '../lib/accounts.js';
import { getSupabaseAdminClient, createUserDatabaseClient } from '../lib/supabase.js';
import { HttpError } from '../lib/http-error.js';
import { requirePermission } from '../lib/permissions.js';

export const authRouter = Router();

const attempts = new Map<string, { count: number; until: number }>();
authRouter.post('/login', async (req, res) => {
  const ip = req.ip ?? 'unknown', now = Date.now();
  for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
  const attempt = attempts.get(ip) ?? { count: 0, until: now + 60_000 };
  if (attempts.size >= 10_000 || ++attempt.count > 10) throw new HttpError(429, 'Too many login attempts. Try again in a minute.');
  attempts.set(ip, attempt);
  const { identifier, password } = req.body ?? {};
  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 254 || typeof password !== 'string' || password.length > 128) throw new HttpError(401, 'Invalid login credentials.');
  let email = identifier.trim();
  if (!email.includes('@')) {
    const { data, error } = await getSupabaseAdminClient().rpc('account_login_email', { identifier: email });
    if (error) databaseError(error);
    email = data ?? 'invalid-login@example.invalid';
  }
  const client = createUserDatabaseClient('');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new HttpError(401, 'Invalid login credentials.');
  // Do not return a usable app session for an inactive/unprovisioned identity.
  try { await currentProfile(createUserDatabaseClient(data.session.access_token)); }
  catch (error) {
    await client.auth.signOut({ scope: 'local' });
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'Account verification is unavailable.');
  }
  res.json({ session: data.session });
});

authRouter.get('/me', requireAuth, (_req, res) => {
  const user = res.locals.user as User;
  res.json({ user: { id: user.id, email: user.email }, profile: res.locals.profile });
});

authRouter.get('/accounts', requireAuth, requirePermission('accounts.read'), async (req, res) => {
  if (Object.keys(req.query).length) throw new HttpError(422, 'Account listing does not accept scope overrides.');
  const { data, error } = await res.locals.database.rpc('read_managed_accounts');
  if (error) databaseError(error);
  res.json({ accounts: data });
});

authRouter.post('/accounts', requireAuth, async (req, res) => {
  const actor = res.locals.profile as Profile;
  if (actor.role === 'Staff') throw new HttpError(403, 'Account creation is not permitted.');
  const input = accountInput(req.body, true);
  if (actor.role === 'Admin' && input.role !== 'Staff') throw new HttpError(403, 'Account creation is not permitted.');
  const operationId = req.body.operationId;
  const email = input.email.trim().toLowerCase();
  const expected = { fullName: input.fullName, username: input.username, role: input.role, email };
  async function outcome() {
    const { data, error } = await res.locals.database.rpc('account_provisioning_result', { operation_id: operationId, expected });
    if (error) databaseError(error);
    return data;
  }
  if (operationId) { const saved = await outcome(); if (saved) { res.json({ user: saved }); return; } }
  const { data, error } = await getSupabaseAdminClient().auth.admin.createUser({
    email, password: input.password, email_confirm: true,
    app_metadata: { vertwell_provision: { actor_id: actor.id, full_name: input.fullName, username: input.username, role: input.role, ...(operationId ? { operation_id: operationId } : {}) } },
  });
  if (error || !data.user) {
    if (operationId) { const saved = await outcome(); if (saved) { res.json({ user: saved }); return; } }
    // Auth rolls back the user when its profile/audit trigger fails. Never echo provider internals.
    throw new HttpError(error?.status && error.status < 500 ? 422 : 409, 'Account creation could not be confirmed. Check current accounts, identifiers and permissions before retrying.');
  }
  res.status(201).json({ user: { id: data.user.id, email: data.user.email } });
});

authRouter.patch('/accounts/:id', requireAuth, async (req, res) => {
  console.info('Account update diagnostic: identity verified.');
  if ((res.locals.profile as Profile).role === 'Staff') throw new HttpError(403, 'Account update is not permitted.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id))) throw new HttpError(422, 'Invalid account ID.');
  const input = accountInput(req.body);
  console.info('Account update diagnostic: fields validated.');
  const { data, error } = await res.locals.database.rpc('update_account', {
    target_id: req.params.id, expected_updated_at: input.updatedAt, full_name: input.fullName,
    username: input.username, account_role: input.role, account_active: input.active,
  });
  console.info('Account update diagnostic: database returned.');
  if (error) databaseError(error);
  res.json({ profile: data });
});
