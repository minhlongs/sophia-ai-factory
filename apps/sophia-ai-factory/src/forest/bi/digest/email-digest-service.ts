/**
 * Executive BI Email Digest Service
 *
 * Implements Resend API email dispatch via src/tree/email/sender.ts
 * and multi-recipient digest orchestration.
 *
 * Layer: forest (side-effect dispatcher)
 *
 * @module forest/bi/digest/email-digest-service
 */

import { sendEmail } from '@/tree/email/sender';
import type { WhiteLabelEmailBranding } from '@/tree/branding/email-styler';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type {
  ExecutiveBIMetricsSummary,
  BrandingSettings,
  EmailDigestOptions,
  EmailDigestResult,
} from './types';
import { formatEmailDigest } from './html-template-builder';
import { extractRecipients } from './digest-aggregator';

/**
 * Sends an Executive BI Email Digest to a recipient email.
 */
export async function sendEmailExecutiveDigest(
  resendApiKey: string | undefined,
  recipientEmail: string,
  metrics: ExecutiveBIMetricsSummary,
  branding?: Partial<BrandingSettings> | WhiteLabelEmailBranding | null,
  options?: Omit<EmailDigestOptions, 'to' | 'branding'>,
): Promise<EmailDigestResult> {
  const recipient = (recipientEmail ?? '').trim();
  if (!recipient) {
    return {
      success: false,
      recipientCount: 0,
      provider: 'dry-run',
      error: 'RECIPIENT_REQUIRED: recipientEmail must not be empty',
    };
  }

  const wrappedHtml = formatEmailDigest(metrics, branding, options);
  const agencyName = branding?.agencyName ?? 'Sophia AI Factory';
  const cadenceLabel = options?.cadence === 'weekly' ? 'Weekly' : 'Monthly';
  const subject = `${agencyName} — ${cadenceLabel} Executive BI Digest`;

  const effectiveApiKey = resendApiKey || process.env.RESEND_API_KEY;

  if (!effectiveApiKey) {
    logger.info('[email-digest-sender] RESEND_API_KEY not provided — operating in dry-run mode', {
      recipient,
      agencyName,
    });
    return {
      success: false,
      recipientCount: 1,
      provider: 'dry-run',
      error: 'RESEND_API_KEY not configured',
    };
  }

  try {
    const res = await sendEmail({
      to: recipient,
      subject,
      html: wrappedHtml,
      branding: branding as WhiteLabelEmailBranding | undefined,
    });

    return {
      success: res.success,
      recipientCount: res.success ? 1 : 0,
      messageId: res.messageId,
      provider: 'resend',
      error: res.error,
    };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    logger.error('[email-digest-sender] Failed sending email digest', {
      recipient,
      error: errMsg,
    });
    return {
      success: false,
      recipientCount: 0,
      provider: 'resend',
      error: errMsg,
    };
  }
}

/**
 * Multi-recipient wrapper alias matching sendEmailDigest(metrics, options).
 */
export async function sendEmailDigest(
  metrics: ExecutiveBIMetricsSummary,
  options: EmailDigestOptions,
): Promise<EmailDigestResult> {
  const recipients = extractRecipients(options);
  if (recipients.length === 0) {
    return { success: false, recipientCount: 0, provider: 'dry-run', error: 'No recipients provided' };
  }

  let successCount = 0;
  let lastMessageId: string | undefined;
  let lastError: string | undefined;

  for (const r of recipients) {
    const res = await sendEmailExecutiveDigest(
      process.env.RESEND_API_KEY,
      r,
      metrics,
      options.branding,
      options,
    );
    if (res.success) {
      successCount++;
      lastMessageId = res.messageId;
    } else {
      lastError = res.error;
    }
  }

  return {
    success: successCount > 0,
    recipientCount: successCount,
    messageId: lastMessageId,
    provider: process.env.RESEND_API_KEY ? 'resend' : 'dry-run',
    error: successCount === 0 ? lastError : undefined,
  };
}
