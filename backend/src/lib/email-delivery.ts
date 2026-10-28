import type { EmailPurpose } from './email-challenges.js';

// Server-owned dependency. Only application composition can install a sender;
// request fields and browser state cannot select one. Never log these transient
// credential values or retain them outside the single delivery attempt.
export interface AccountEmailMessage {
  email: string;
  purpose: EmailPurpose;
  code: string;
  tokenHash: string;
  linkProof: string;
  link: string;
}

export interface EmailDelivery {
  origin: string;
  send(message: AccountEmailMessage): Promise<'accepted' | 'rejected'>;
}
