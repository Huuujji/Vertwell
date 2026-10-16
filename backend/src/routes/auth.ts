import type { User } from '@supabase/supabase-js';
import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';

export const authRouter = Router();

authRouter.get('/me', requireAuth, (_req, res) => {
  const user = res.locals.user as User;
  res.json({ user: { id: user.id, email: user.email } });
});
