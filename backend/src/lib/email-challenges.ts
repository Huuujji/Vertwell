import { randomUUID, createHash } from 'node:crypto';
import type { EmailDelivery } from './email-delivery.js';
import { getSupabaseAdminClient, createUserDatabaseClient } from './supabase.js';
import { HttpError } from './http-error.js';

export type EmailPurpose = 'verification' | 'recovery';
export const emailPolicy = { expirySeconds: 900, resendSeconds: 60, attempts: 5 } as const;
const invalid = () => new HttpError(422, 'This code or link is invalid, expired, already used or has reached its attempt limit. Request a fresh email.');
async function challenge(command: Record<string, unknown>) {
  const { data, error } = await getSupabaseAdminClient().rpc('email_challenge', { command }).abortSignal(AbortSignal.timeout(5000));
  if (error || typeof data?.allowed !== 'boolean') throw new HttpError(503, 'Email verification is unavailable. Try again shortly.');
  return data;
}
export async function sendAccountEmail(email: string, purpose: EmailPurpose, delivery?: EmailDelivery) {
  if (!delivery) throw new HttpError(503, 'Account email delivery is not configured. Ask the Owner to complete sender setup.');
  const origin = new URL(delivery.origin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new HttpError(503, 'Account email delivery is not configured correctly.');
  }
  const ticket = randomUUID();
  const reserved = await challenge({ action: 'reserve', email, purpose, ticket });
  if (!reserved.allowed) return false;
  const { data, error } = await getSupabaseAdminClient().auth.admin.generateLink(purpose === 'verification'
    ? { type: 'signup', email: reserved.email.toLowerCase(), password: randomUUID()+randomUUID() }
    : { type: 'recovery', email: reserved.email.toLowerCase() });
  const hash = data?.properties?.hashed_token, code = data?.properties?.email_otp;
  if (error || data?.user?.id !== reserved.userId || data.user.email?.toLowerCase() !== email.toLowerCase() ||
      data.properties?.verification_type !== (purpose === 'verification' ? 'signup' : 'recovery') ||
      typeof hash !== 'string' || !/^[a-f0-9]{56}$/.test(hash) || typeof code !== 'string' || !/^\d{6,8}$/.test(code) ||
      createHash('sha224').update(reserved.email.toLowerCase()+code).digest('hex') !== hash) return false;
  if (!(await challenge({ action: 'activate', email, purpose, ticket, userId: data.user.id, tokenHash: hash })).allowed) return false;
  // Never use the provider's automatic-consumption action_link or a caller redirect.
  const linkProof = `${hash}.${ticket}`;
  const link = `${origin.origin}/auth/${purpose === 'verification' ? 'verify' : 'recover'}#token_hash=${linkProof}`;
  // A thrown/lost delivery response may have delivered the email: leave its exact
  // proof active, report failure, and never automatically send another message.
  let result: 'accepted' | 'rejected';
  try { result = await delivery.send({ email: reserved.email, purpose, code, tokenHash: hash, linkProof, link }); }
  catch { throw new HttpError(503, 'Email delivery could not be confirmed. If an email arrives, its code or link may still work. Wait before requesting another.'); }
  if (result !== 'accepted') {
    await challenge({ action: 'cancel', email, purpose, ticket });
    return false;
  }
  return true;
}
export async function completeAccountEmail(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const c = body as Record<string, unknown>;
  if (Object.keys(c).some(k => !['purpose','email','code','tokenHash','password'].includes(k)) ||
      !['verification','recovery'].includes(String(c.purpose))) throw invalid();
  const purpose = c.purpose as EmailPurpose;
  const byLink = typeof c.tokenHash === 'string' && /^[a-f0-9]{56}\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(c.tokenHash);
  const byCode = typeof c.email === 'string' && c.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) &&
    typeof c.code === 'string' && /^\d{6,8}$/.test(c.code);
  if ((!byLink && !byCode) || (c.tokenHash !== undefined && !byLink) || (byLink && (c.email !== undefined || c.code !== undefined)) ||
      (purpose === 'verification' && c.password !== undefined) ||
      (purpose === 'recovery' && (typeof c.password !== 'string' || c.password.length < 8 || c.password.length > 128))) throw invalid();
  const proof = await challenge({ action: 'consume', purpose,
    ...(byLink ? { tokenHash: String(c.tokenHash).split('.')[0], ticket: String(c.tokenHash).split('.')[1] } : { email: String(c.email).trim().toLowerCase(), code: c.code }) });
  if (!proof.allowed) {
    const messages: Record<string,string> = { expired: 'This code or link has expired. Request a fresh email.', used: 'This challenge has already been used. Request a fresh email if needed.', attempts: 'This challenge has reached its attempt limit. Request a fresh email.', processing: 'This challenge is being processed or needs an Owner session review. Do not submit it again.' };
    throw new HttpError(422, messages[proof.reason] ?? invalid().message);
  }
  const client = createUserDatabaseClient('');
  let recipientSession = false;
  let matchedRecipient = false;
  let outcome: 'completed' | 'failed' | 'uncertain' = 'uncertain';
  try {
    const { data, error } = await client.auth.verifyOtp({ token_hash: proof.tokenHash, type: purpose === 'verification' ? 'signup' : 'recovery' });
    recipientSession = !!data.session;
    if (error || !data.session || data.user?.id !== proof.userId || data.session.user.id !== proof.userId) {
      if (error && (error.status ?? 0) >= 400 && (error.status ?? 0) < 500 || recipientSession) outcome = 'failed';
      throw invalid();
    }
    matchedRecipient = true;
    if (purpose === 'recovery') {
      // Only the native session obtained from THIS recovery challenge can change
      // the password. No stored/login/verification session is used as proof.
      const { error: updateError } = await client.auth.updateUser({ password: c.password as string });
      if (updateError) {
        if ((updateError.status ?? 0) >= 400 && (updateError.status ?? 0) < 500) outcome = 'failed';
        throw new HttpError(422, 'Password change could not be confirmed. Request a fresh email if allowed; otherwise ask the Owner to review the account.');
      }
    }
    outcome = 'completed';
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'Completion could not be confirmed. Ask the Owner to review this account before retrying.');
  } finally {
    try {
    if (recipientSession) {
      // A mismatched provider identity must also be cleaned up, without globally
      // revoking that unexpected account's other sessions.
      const { error: cleanupError } = await client.auth.signOut({ scope: matchedRecipient && purpose === 'recovery' ? 'global' : 'local' });
      if (cleanupError) {
        outcome = 'uncertain';
        throw new HttpError(503, 'Session cleanup could not be confirmed. Ask the Owner to review account sessions before continuing.');
      }
    }
    } catch { outcome = 'uncertain'; throw new HttpError(503, 'Session cleanup could not be confirmed. Ask the Owner to review account sessions before continuing.'); }
    finally {
      if (!(await challenge({ action: 'finish', email: proof.email, purpose, ticket: proof.ticket, outcome })).allowed)
        throw new HttpError(503, 'Completion could not be recorded. Ask the Owner to review this account before retrying.');
    }
  }
  return { verified: true, purpose };
}
