import type { RequestHandler } from 'express';
import { getSupabaseAuthClient, createUserDatabaseClient } from '../lib/supabase.js';
import { currentProfile } from '../lib/accounts.js';
import { HttpError } from '../lib/http-error.js';

export const requireAuth: RequestHandler = async (req, res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
  const token = match?.[1];
  if (!token) throw new HttpError(401, 'A Bearer access token is required.');

  const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired access token.');

  res.locals.user = data.user;
  res.locals.accessToken = token;
  res.locals.database = createUserDatabaseClient(token);
  res.locals.profile = await currentProfile(res.locals.database);
  if (res.locals.profile.id !== data.user.id) throw new HttpError(403, 'Account profile does not match the authenticated user.');
  next();
};
