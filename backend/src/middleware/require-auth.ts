import type { RequestHandler } from 'express';
import { getSupabaseAuthClient } from '../lib/supabase.js';
import { HttpError } from '../lib/http-error.js';

export const requireAuth: RequestHandler = async (req, res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
  const token = match?.[1];
  if (!token) throw new HttpError(401, 'A Bearer access token is required.');

  const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired access token.');

  res.locals.user = data.user;
  res.locals.accessToken = token;
  next();
};
