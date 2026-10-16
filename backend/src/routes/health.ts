import { Router } from 'express';
import { isSupabaseConfigured } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'vertwell-api', supabaseConfigured: isSupabaseConfigured });
});
