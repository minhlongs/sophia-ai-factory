/**
 * Email Sender — Resend integration for transactional emails.
 *
 * Sends emails via Resend API (https://resend.com).
 * Requires RESEND_API_KEY env var.
 * Falls back to dry-run logging when key is not configured.
 */

import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';

export interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'resend' | 'dry-run';
}

export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  if (!shouldAllowRequest('email')) {
    throw new Error('[email-sender] Circuit breaker open for email');
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = params.from ?? process.env.EMAIL_FROM ?? 'Sophia AI <noreply@mekongmind.com>';

  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured', provider: 'dry-run' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html ?? `<pre>${params.text ?? params.subject}</pre>`,
        reply_to: params.replyTo,
        tags: params.tags,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch((err) => {
        logger.warn('Failed to read Resend error response body', { error: String(err), context: 'sendEmail' });
        return '';
      });
      return { success: false, error: `Resend ${res.status}: ${errBody.slice(0, 200)}`, provider: 'resend' };
    }

    const data = await res.json() as { id?: string };
    return { success: true, messageId: data.id, provider: 'resend' };
  } catch (err) {
    return { success: false, error: toError(err).message, provider: 'resend' };
  }
}
