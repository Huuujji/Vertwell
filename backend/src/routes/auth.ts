import type { User } from '@supabase/supabase-js';
import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { accountInput, currentProfile, databaseError, type Profile } from '../lib/accounts.js';
import { getSupabaseAdminClient, createUserDatabaseClient } from '../lib/supabase.js';
import { HttpError } from '../lib/http-error.js';
import { requirePermission } from '../lib/permissions.js';
import { completeAccountEmail, emailPolicy, sendAccountEmail } from '../lib/email-challenges.js';
import { createLoginProtection } from '../lib/login-protection.js';
import type { EmailDelivery } from '../lib/email-delivery.js';
import { deleteManagedAccount, deletionInput } from '../lib/account-deletion.js';

export function createAuthRouter(delivery?: EmailDelivery) {
const authRouter = Router();

authRouter.post('/email/request', createLoginProtection(), async (req, res) => {
  const { email, purpose } = req.body ?? {};
  if (Object.keys(req.body ?? {}).some(k => !['email','purpose'].includes(k)) || typeof email !== 'string' || email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['verification','recovery'].includes(purpose)) throw new HttpError(422, 'Enter your account email and email purpose.');
  await sendAccountEmail(email.trim().toLowerCase(), purpose, delivery);
  res.json({ message: 'If this account is eligible, an email has been requested. Wait at least 60 seconds before requesting another.', policy: emailPolicy });
});
authRouter.post('/email/complete', createLoginProtection(), async (req, res) => {
  res.json(await completeAccountEmail(req.body));
});

authRouter.post('/login', async (req, res) => {
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
  if (error && (!error.status || [408, 429].includes(error.status) || error.status >= 500)) throw new HttpError(503, 'Authentication service is unavailable. Try again shortly.');
  // A native unconfirmed-email result opens only the existing verification
  // page. It grants no session, sends no email and never treats other login
  // failures (wrong credentials, inactive accounts or outages) as pending.
  const verificationRequired = () => res.status(403).json({ error: {
    message: 'Verify your account email before signing in.', fields: { accountEmail: 'verification_required' },
  } });
  if (error?.code === 'email_not_confirmed') { verificationRequired(); return; }
  if (error || !data.session) throw new HttpError(401, 'Invalid login credentials.');
  if (data.user?.app_metadata?.happyhentie_email_required === true && !data.user.email_confirmed_at) {
    const { error: cleanupError } = await client.auth.signOut({ scope: 'local' });
    if (cleanupError) throw new HttpError(503, 'Session cleanup could not be confirmed. Try again shortly.');
    verificationRequired(); return;
  }
  // Do not return a usable app session for an inactive/unprovisioned identity.
  try { await currentProfile(createUserDatabaseClient(data.session.access_token)); }
  catch (error) {
    await client.auth.signOut({ scope: 'local' });
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'Account verification is unavailable.');
  }
  // The browser needs tokens only; omit the provider's duplicate user/metadata
  // payload. Authentication still requires the token's subject identifier.
  res.json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
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
  function replay(saved: { emailVerification?: string }) {
    // A replay does not send another email. Delivery of the original request is
    // unknown; never turn an ambiguous response into a delivery claim.
    res.json({ user: saved, verification: saved.emailVerification ?? 'existing', emailRequested: null });
  }
  if (operationId) { const saved = await outcome(); if (saved) { replay(saved); return; } }
  const { data, error } = await getSupabaseAdminClient().auth.admin.createUser({
    email, password: input.password, email_confirm: false,
    app_metadata: { happyhentie_email_required: true, vertwell_provision: { actor_id: actor.id, full_name: input.fullName, username: input.username, role: input.role, ...(operationId ? { operation_id: operationId } : {}) } },
  });
  if (error || !data.user) {
    if (operationId) { const saved = await outcome(); if (saved) { replay(saved); return; } }
    // Auth rolls back the user when its profile/audit trigger fails. Never echo provider internals.
    throw new HttpError(error?.status && error.status < 500 ? 422 : 409, 'Account creation could not be confirmed. Check current accounts, identifiers and permissions before retrying.');
  }
  // A delivery failure must never undo a committed account or cause provisioning
  // retries to create another identity. The recipient can explicitly resend.
  let emailRequested = false;
  try { emailRequested = await sendAccountEmail(email, 'verification', delivery); } catch { /* Account is safely pending. */ }
  res.status(201).json({ user: { id: data.user.id, email: data.user.email }, verification: 'pending', emailRequested });
});

authRouter.patch('/accounts/:id', requireAuth, async (req, res) => {
  if ((res.locals.profile as Profile).role === 'Staff') throw new HttpError(403, 'Account update is not permitted.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id))) throw new HttpError(422, 'Invalid account ID.');
  const input = accountInput(req.body);
  const { data, error } = await res.locals.database.rpc('update_account', {
    target_id: req.params.id, expected_updated_at: input.updatedAt, full_name: input.fullName,
    username: input.username, account_role: input.role,
  });
  if (error) databaseError(error);
  res.json({ profile: data });
});
authRouter.delete('/accounts/:id', requireAuth, async (req, res) => {
  if ((res.locals.profile as Profile).role === 'Staff') throw new HttpError(403, 'Account deletion is not permitted.');
  const command = deletionInput(req.params.id, req.body);
  res.json(await deleteManagedAccount(res.locals.database, getSupabaseAdminClient(), command));
});
authRouter.post('/accounts/:id/deletion-result', requireAuth, async (req, res) => {
  if ((res.locals.profile as Profile).role === 'Staff') throw new HttpError(403, 'Account deletion is not permitted.');
  const command = deletionInput(req.params.id, req.body);
  const { data, error } = await res.locals.database.rpc('account_deletion_result', command).abortSignal(AbortSignal.timeout(5000));
  if (error) databaseError(error);
  res.json(data);
});
return authRouter;
}
