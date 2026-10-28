import type { RequestHandler } from 'express';
import { getSupabaseAuthClient, createUserDatabaseClient } from '../lib/supabase.js';
import { currentProfile } from '../lib/accounts.js';
import { HttpError } from '../lib/http-error.js';

export const requireAuth: RequestHandler = async (req, res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
  const token = match?.[1];
  if (!token) throw new HttpError(401, 'A Bearer access token is required.');

  const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
  if (error && (!error.status || [408, 429].includes(error.status) || error.status >= 500)) throw new HttpError(503, 'Authentication service is unavailable. Try again shortly.');
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired access token.');
  if (data.user.app_metadata?.happyhentie_email_required === true && !data.user.email_confirmed_at)
    throw new HttpError(403, 'Verify your account email before accessing the shop.');

  res.locals.user = data.user;
  res.locals.accessToken = token;
  res.locals.database = createUserDatabaseClient(token);
  res.locals.profile = await currentProfile(res.locals.database);
  if (res.locals.profile.id !== data.user.id) throw new HttpError(403, 'Account profile does not match the authenticated user.');
  next();
};
