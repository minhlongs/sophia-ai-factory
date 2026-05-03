/**
 * Handover welcome email service.
 * Uses Resend (existing infra) to send the magic link + onboarding doc.
 * Delegates template rendering to @/lib/email/render-email (unified registry).
 * @module lib/handover/handover-email-service
 */

import { Resend } from 'resend';
import { logger } from '@/seed/utils/logger-utility';
import { renderEmail } from '@/forest/email/render-email';
import { SENDER_FROM } from '@/forest/email/templates/shared-layout';
import type { Tier } from '@/seed/types';

// ── Input types ───────────────────────────────────────────────────────────────

export interface AutoWelcomeEmailInput {
  toEmail: string;
  ownerFullName: string;
  tier: Tier;
  magicLinkUrl: string;
  locale: string;
}

export interface TierUpgradeEmailInput {
  toEmail: string;
  ownerFullName: string;
  newTier: Tier;
  locale: string;
}

export interface WelcomeEmailInput {
  toEmail: string;
  ownerFullName: string;
  agencyName: string;
  tier: Tier;
  magicLinkUrl: string;
  locale: string;
  handoverMarkdown: string;
}

export interface PromoWelcomeEmailInput {
  toEmail: string;
  ownerFullName: string;
  promoCode: string;
  discountDescription: string;
  tier: Tier;
  magicLinkUrl: string;
  trialDaysGranted?: number;
  locale: string;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// ── Public send functions ─────────────────────────────────────────────────────

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
  const isVi = input.locale.startsWith('vi');
  const subject = isVi
    ? `Mã ${input.promoCode} đã kích hoạt — Sophia AI Factory`
    : `Code ${input.promoCode} activated — Sophia AI Factory`;

  if (!resend) {
    logger.info('[HandoverEmail] Promo welcome — Resend not configured', { to: input.toEmail });
    return;
  }

  const greeting = isVi ? `Xin chào ${input.ownerFullName},` : `Hello ${input.ownerFullName},`;
  const intro = isVi
    ? `Mã khuyến mãi <strong>${input.promoCode}</strong> đã được áp dụng: <strong>${input.discountDescription}</strong>.`
    : `Promo code <strong>${input.promoCode}</strong> applied: <strong>${input.discountDescription}</strong>.`;
  const trialNote =
    input.trialDaysGranted && input.trialDaysGranted > 0
      ? isVi
        ? `<p style="margin:0 0 16px;color:#a1a1aa;font-size:13px">Bản dùng thử <strong>${input.trialDaysGranted} ngày</strong> của bạn đã bắt đầu.</p>`
        : `<p style="margin:0 0 16px;color:#a1a1aa;font-size:13px">Your <strong>${input.trialDaysGranted}-day free trial</strong> has started.</p>`
      : '';
  const ctaLabel = isVi ? 'Truy Cập Sophia Ngay' : 'Access Sophia Now';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#e4e4e7;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(139,92,246,0.12));border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:32px">
      <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;background:linear-gradient(135deg,#34d399,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Sophia AI Factory</h1>
      <p style="color:#a1a1aa;margin:0 0 24px;font-size:14px">${isVi ? 'Mã khuyến mãi đã kích hoạt' : 'Promo code activated'}</p>
      <p style="margin:0 0 16px">${greeting}</p>
      <p style="margin:0 0 16px;line-height:1.6">${intro}</p>
      ${trialNote}
      <a href="${input.magicLinkUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#7c3aed);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:16px">${ctaLabel}</a>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
      <p style="color:#a1a1aa;font-size:13px;margin:0">${isVi ? 'Hỗ trợ' : 'Support'}: <a href="mailto:support@mekongmind.com" style="color:#34d399">support@mekongmind.com</a></p>
    </div>
  </div>
</body>
</html>`;

  try {
    const result = await resend.emails.send({ from: SENDER_FROM, to: [input.toEmail], subject, html });
    logger.info('[HandoverEmail] Promo welcome sent', { emailId: result.data?.id, to: input.toEmail });
  } catch (err) {
    logger.warn('[HandoverEmail] Promo welcome send failed', { to: input.toEmail, error: err instanceof Error ? err.message : String(err) });
  }
}
