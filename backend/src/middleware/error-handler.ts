import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { message: error.message } });
    return;
  }

  const parserError = error as { type?: string } | null;
  if (parserError?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Request body must contain valid JSON.' } });
    return;
  }
  if (parserError?.type === 'entity.too.large') {
    res.status(413).json({ error: { message: 'Request body is too large.' } });
    return;
  }

  // Provider errors can contain request/credential details. Do not log raw objects.
  console.error('Unhandled API error.');
  res.status(500).json({ error: { message: 'An unexpected server error occurred.' } });
};
