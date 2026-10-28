import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { HttpError } from './lib/http-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { createAuthRouter } from './routes/auth.js';
import type { EmailDelivery } from './lib/email-delivery.js';
import { createBrevoEmailDelivery } from './lib/brevo-email-delivery.js';
import { healthRouter } from './routes/health.js';
import { businessRouter } from './routes/business.js';
import { inventoryRouter } from './routes/inventory.js';
import { createLoginProtection } from './lib/login-protection.js';
import { observeRequests, type MonitoringOptions } from './middleware/observe-requests.js';
import { createOperationsRouter } from './routes/operations.js';

export function createApp(monitoring: MonitoringOptions = {}, emailDelivery?: EmailDelivery) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', observeRequests({ slowMs: env.slowRequestMs, ...monitoring }));
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) callback(null, true);
      else callback(new HttpError(403, 'This frontend origin is not allowed.'));
    },
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/health', healthRouter);
  app.post('/api/auth/login', createLoginProtection());
  app.use('/api/auth', createAuthRouter(emailDelivery));
  app.use('/api/operations', createOperationsRouter());
  app.use('/api', inventoryRouter);
  app.use('/api', businessRouter);
  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Endpoint not found.' } });
  });
  app.use(errorHandler);
  return app;
}

// Vercel detects this default export; local development uses server.ts.
export default createApp({}, createBrevoEmailDelivery(env.accountEmail));
