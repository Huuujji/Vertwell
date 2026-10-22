import { apiRequest } from './api';
import { createOperationalReporter } from './operational-events';

export const reportOperationalEvent = createOperationalReporter(event => apiRequest('/api/operations/client-events', {
  method: 'POST', body: JSON.stringify({ event }), signal: AbortSignal.timeout(3000),
}));
