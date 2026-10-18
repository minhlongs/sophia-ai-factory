/**
 * Resend client singleton
 * @module land/billing/email/resend-client
 */

import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResend(): Resend | null {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    resendClient = new Resend(key);
  }
  return resendClient;
}

export const EMAIL_TYPE = 'bundle_generating';