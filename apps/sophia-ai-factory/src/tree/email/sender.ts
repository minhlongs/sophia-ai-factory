/**
 * Email Sender — Resend integration with White-Label Brand Formatting
 *
 * Sends transactional emails via Resend API (https://resend.com).
 * Injects white-label headers, styling, and footers when branding is provided.
 * Falls back to dry-run logging when RESEND_API_KEY is not configured.
 *
 * Layer: tree
 * Allowed imports: @/seed/*, @/tree/*
 *
 * @module tree/email/sender
 */

import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { htmlToText } from '@/tree/email/templates/shared-layout';
import {
  formatWhiteLabelEmail,
  formatWhiteLabelPlainText,
} from '@/tree/branding/email-styler';
import type { WhiteLabelEmailBranding } from '@/tree/branding/email-styler';

export interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  /** Optional agency white-label branding options (MASTER tier) */
  branding?: WhiteLabelEmailBranding | null;
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

  // 1. Resolve 'from' address:
  let from = params.from;
  if (!from) {
    if (params.branding?.emailFromName && params.branding?.customDomain) {
      from = `${params.branding.emailFromName} <noreply@${params.branding.customDomain}>`;
    } else if (params.branding?.emailFromName) {
      from = `${params.branding.emailFromName} <noreply@sophia.agencyos.network>`;
    } else {
      from = process.env.EMAIL_FROM ?? 'Sophia AI <noreply@mekongmind.com>';
    }
  }

  // 2. Resolve 'replyTo' address:
  const replyTo = params.replyTo ?? params.branding?.supportEmail ?? undefined;

  // 3. Apply White-Label Formatting to HTML:
  let finalHtml = params.html;
  if (finalHtml && params.branding) {
    finalHtml = formatWhiteLabelEmail(finalHtml, params.branding);
  }

  // 4. Generate Plain Text Fallback:
  let finalText = params.text;
  if (!finalText && finalHtml) {
    finalText = htmlToText(finalHtml);
  } else if (finalText && params.branding) {
    finalText = formatWhiteLabelPlainText(finalText, params.branding);
  }

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
        html: finalHtml ?? `<pre>${finalText ?? params.subject}</pre>`,
        text: finalText,
        reply_to: replyTo,
        tags: params.tags,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch((err) => {
        logger.warn('Failed to read Resend error response body', {
          error: String(err),
          context: 'sendEmail',
        });
        return '';
      });
      return {
        success: false,
        error: `Resend ${res.status}: ${errBody.slice(0, 200)}`,
        provider: 'resend',
      };
    }

    const data = (await res.json()) as { id?: string };
    return { success: true, messageId: data.id, provider: 'resend' };
  } catch (err) {
    return { success: false, error: toError(err).message, provider: 'resend' };
  }
}
