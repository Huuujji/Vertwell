import type { EmailDelivery } from './email-delivery.js';
import { accountEmailAddress, accountEmailOrigin, renderAccountEmail } from './account-email-renderer.js';

export interface BrevoEmailConfiguration {
  origin?: string;
  apiKey?: string;
  fromEmail?: string;
  replyToEmail?: string;
}

const endpoint = 'https://api.brevo.com/v3/smtp/email';
const unavailable = () => new Error('Email delivery could not be confirmed.');
// Only explicit request/auth/recipient/rate rejections cancel an unused ticket.
// Timeouts, redirects, conflicts, unknown statuses and malformed success remain
// ambiguous: the coordinator retains the exact proof and never retries the send.
const rejectedStatuses = new Set([400, 401, 403, 404, 405, 413, 415, 422, 429]);

export function createBrevoEmailDelivery(configuration: BrevoEmailConfiguration,
  transport: typeof fetch = (input, init) => globalThis.fetch(input, init)): EmailDelivery | undefined {
  const origin = accountEmailOrigin(configuration.origin);
  const { apiKey, fromEmail, replyToEmail } = configuration;
  // No guessed origin, sender, Reply-To or credentials. Incomplete/invalid
  // configuration leaves issuance closed before native credentials are created.
  if (!origin || typeof apiKey !== 'string' || apiKey.length < 1 || apiKey.length > 1024 || /[^\x21-\x7e]/.test(apiKey) ||
      !accountEmailAddress(fromEmail) || !accountEmailAddress(replyToEmail)) return undefined;
  return {
    origin,
    async send(message) {
      let content: ReturnType<typeof renderAccountEmail>;
      try { content = renderAccountEmail(message, origin); }
      catch { return 'rejected'; } // Local validation proves no submission occurred.
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(unavailable()); }, 5000);
        });
        const attempt = async (): Promise<'accepted' | 'rejected'> => {
          const response = await transport(endpoint, {
            method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal,
            headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
            body: JSON.stringify({
              sender: { name: 'HappyHentie', email: fromEmail }, to: [{ email: message.email }],
              replyTo: { email: replyToEmail }, ...content,
            }),
          });
          if (response.status !== 201) {
            void response.body?.cancel().catch(() => {});
            if (rejectedStatuses.has(response.status)) return 'rejected';
            throw unavailable();
          }
          // Bound the acknowledgement too. Never expose/log the provider body,
          // request, message ID, transient proofs or key, including on failures.
          const reader = response.body?.getReader();
          if (!reader) throw unavailable();
          const stopReading = () => { void reader.cancel().catch(() => {}); };
          controller.signal.addEventListener('abort', stopReading, { once: true });
          const chunks: Uint8Array[] = [];
          let length = 0;
          try {
            for (;;) {
              const part = await reader.read();
              if (part.done) break;
              length += part.value.length;
              if (length > 4096) throw unavailable();
              chunks.push(part.value);
            }
          } finally {
            controller.signal.removeEventListener('abort', stopReading);
            void reader.cancel().catch(() => {});
          }
          const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!data || typeof data !== 'object' || !('messageId' in data) ||
              typeof data.messageId !== 'string' || data.messageId.length < 1 || data.messageId.length > 256 || /[^\x21-\x7e]/.test(data.messageId)) throw unavailable();
          return 'accepted'; // Submission accepted, never a claim of inbox delivery.
        };
        return await Promise.race([attempt(), deadline]);
      } catch { throw unavailable(); }
      finally { if (timer) clearTimeout(timer); controller.abort(); }
    },
  };
}
