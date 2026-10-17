import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { HttpError } from './lib/http-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { businessRouter } from './routes/business.js';
import { inventoryRouter } from './routes/inventory.js';

const app = express();
app.disable('x-powered-by');
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
app.use('/api/auth', authRouter);
app.use('/api', inventoryRouter);
app.use('/api', businessRouter);
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Endpoint not found.' } });
});
app.use(errorHandler);

// Vercel detects this default export; local development uses server.ts.
export default app;
