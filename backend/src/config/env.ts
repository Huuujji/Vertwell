import 'dotenv/config';

const port = Number(process.env.PORT ?? 3001);
const slowRequestMs = Number(process.env.SLOW_REQUEST_MS ?? 2000);
if (!Number.isInteger(slowRequestMs) || slowRequestMs < 100 || slowRequestMs > 60000) {
  throw new Error('SLOW_REQUEST_MS must be an integer between 100 and 60000.');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

export const env = {
  production: process.env.NODE_ENV === 'production',
  vercel: process.env.VERCEL === '1',
  loginRateLimitMode: process.env.LOGIN_RATE_LIMIT_MODE?.trim() ?? '',
  slowRequestMs,
  port,
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL?.trim() ?? '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY?.trim() ?? '',
  accountEmail: {
    origin: process.env.ACCOUNT_EMAIL_ORIGIN ?? '',
    apiKey: process.env.BREVO_API_KEY ?? '',
    fromEmail: process.env.ACCOUNT_EMAIL_FROM ?? '',
    replyToEmail: process.env.ACCOUNT_EMAIL_REPLY_TO ?? '',
  },
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
