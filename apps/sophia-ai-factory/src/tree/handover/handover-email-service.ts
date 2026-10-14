/**
 * Handover welcome email service.
 * Uses Resend (existing infra) to send the magic link + onboarding doc.
 * Delegates template rendering to @/seed/email/render-email (unified registry).
 * @module lib/handover/handover-email-service
 */

import { Resend } from 'resend';
import { logger } from '@/seed/utils/logger-utility';
import { renderEmail } from '@/tree/email';
import { SENDER_FROM } from '@/tree/email/templates/shared-layout';
import {
  buildPromoWelcomeEmailContent,
  type AutoWelcomeEmailInput,
  type TierUpgradeEmailInput,
  type WelcomeEmailInput,
  type PromoWelcomeEmailInput,
} from './handover-promo-email-builder';

export type {
  AutoWelcomeEmailInput,
  TierUpgradeEmailInput,
  WelcomeEmailInput,
  PromoWelcomeEmailInput,
};

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/** Send welcome email with magic link to new customer (admin-wizard variant). */
export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<{
  success: boolean;
  emailId?: string;
  error?: string;
}> {
  const resend = getResendClient();

  if (!resend) {
    logger.info('[HandoverEmail] Resend not configured — logging email only', { to: input.toEmail });
    return { success: true, emailId: 'logged-only' };
  }

  try {
    const { html, text, subject } = renderEmail('welcome-magic-link', {
      ownerFullName: input.ownerFullName,
      tier: input.tier,
      magicLinkUrl: input.magicLinkUrl,
      locale: input.locale,
      agencyName: input.agencyName,
    });
    const result = await resend.emails.send({ from: SENDER_FROM, to: [input.toEmail], subject, html, text });
    if (result.error) {
      logger.error('[HandoverEmail] Resend error', undefined, { error: result.error });
      return { success: false, error: String(result.error) };
    }
    logger.info('[HandoverEmail] Welcome email sent', { emailId: result.data?.id, to: input.toEmail });
    return { success: true, emailId: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[HandoverEmail] Send failed', err instanceof Error ? err : undefined);
    return { success: false, error: msg };
  }
}

/** Send auto-payment welcome email (purchase-confirmed framing, not admin-wizard framing). */
export async function sendAutoHandoverWelcomeEmail(input: AutoWelcomeEmailInput): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    logger.info('[HandoverEmail] Auto welcome — Resend not configured', { to: input.toEmail });
    return;
  }
  try {
    const { html, text, subject } = renderEmail('welcome-magic-link', {
      ownerFullName: input.ownerFullName,
      tier: input.tier,
      magicLinkUrl: input.magicLinkUrl,
      locale: input.locale,
    });
    const result = await resend.emails.send({ from: SENDER_FROM, to: [input.toEmail], subject, html, text });
    logger.info('[HandoverEmail] Auto welcome sent', { emailId: result.data?.id, to: input.toEmail });
  } catch (err) {
    logger.warn('[HandoverEmail] Auto welcome send failed', { to: input.toEmail, error: err instanceof Error ? err.message : String(err) });
  }
}

/** Send tier-upgrade notification to existing customer. */
export async function sendTierUpgradeEmail(input: TierUpgradeEmailInput): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    logger.info('[HandoverEmail] Tier upgrade — Resend not configured', { to: input.toEmail });
    return;
  }
  try {
    const { html, text, subject } = renderEmail('tier-upgrade', {
      ownerFullName: input.ownerFullName,
      newTier: input.newTier,
      locale: input.locale,
    });
    const result = await resend.emails.send({ from: SENDER_FROM, to: [input.toEmail], subject, html, text });
    logger.info('[HandoverEmail] Tier upgrade email sent', { emailId: result.data?.id, to: input.toEmail });
  } catch (err) {
    logger.warn('[HandoverEmail] Tier upgrade send failed', { to: input.toEmail, error: err instanceof Error ? err.message : String(err) });
  }
}

/** Send promo code welcome email with discount/trial confirmation. */
export async function sendPromoCodeWelcomeEmail(input: PromoWelcomeEmailInput): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    logger.info('[HandoverEmail] Promo welcome — Resend not configured', { to: input.toEmail });
    return;
  }

  const { subject, html } = buildPromoWelcomeEmailContent(input);

  try {
    const result = await resend.emails.send({ from: SENDER_FROM, to: [input.toEmail], subject, html });
    logger.info('[HandoverEmail] Promo welcome sent', { emailId: result.data?.id, to: input.toEmail });
  } catch (err) {
    logger.warn('[HandoverEmail] Promo welcome send failed', { to: input.toEmail, error: err instanceof Error ? err.message : String(err) });
  }
}
