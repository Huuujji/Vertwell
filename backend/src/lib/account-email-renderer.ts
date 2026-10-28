import { createHash } from 'node:crypto';
import type { AccountEmailMessage } from './email-delivery.js';
import { accountEmailTemplates } from './account-email-templates.generated.js';

const invalid = () => new Error('Account email content is invalid.');
const ticketPattern = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const proofPattern = new RegExp(`^[a-f0-9]{56}\\.${ticketPattern}$`);

export function accountEmailAddress(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && !/[\s\x00-\x1f\x7f]/.test(value) &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

export function accountEmailOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        !/^[a-z0-9.-]+$/i.test(url.hostname) || ![url.origin, `${url.origin}/`].includes(value)) return undefined;
    return url.origin;
  } catch { return undefined; }
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, character => entities[character]!);
}

export function renderAccountEmail(message: AccountEmailMessage, origin: string) {
  const canonical = accountEmailOrigin(origin);
  if (!canonical || !message || [message.email, message.purpose, message.code, message.tokenHash, message.linkProof, message.link]
    .some(value => typeof value !== 'string' || /[\x00-\x20\x7f]/.test(value))) throw invalid();
  if (!accountEmailAddress(message.email) ||
      !['verification', 'recovery'].includes(message.purpose) || typeof message.code !== 'string' || !/^\d{6,8}$/.test(message.code) ||
      typeof message.tokenHash !== 'string' || !/^[a-f0-9]{56}$/.test(message.tokenHash) ||
      typeof message.linkProof !== 'string' || !proofPattern.test(message.linkProof) ||
      message.linkProof.slice(0, 56) !== message.tokenHash ||
      createHash('sha224').update(message.email.toLowerCase() + message.code).digest('hex') !== message.tokenHash ||
      message.link !== `${canonical}/auth/${message.purpose === 'verification' ? 'verify' : 'recover'}#token_hash=${message.linkProof}`) throw invalid();

  const template = accountEmailTemplates[message.purpose];
  const values: Record<string, string> = { Token: message.code, SiteURL: canonical, ChallengeLink: message.link };
  const htmlContent = template.html.replace(/{{\s*\.(\w+)\s*}}/g, (_expression, name: string) => {
    if (!Object.hasOwn(values, name)) throw invalid();
    return escapeHtml(values[name]!);
  });
  if (htmlContent.includes('{{')) throw invalid();
  return { subject: template.subject, htmlContent };
}
