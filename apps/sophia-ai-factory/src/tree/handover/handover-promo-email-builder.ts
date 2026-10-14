/**
 * Promo welcome email HTML builder and input types for handover email service.
 * @module tree/handover/handover-promo-email-builder
 */

import type { Tier } from '@/seed/types';

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

export function buildPromoWelcomeEmailContent(input: PromoWelcomeEmailInput): {
  subject: string;
  html: string;
} {
  const isVi = input.locale.startsWith('vi');
  const subject = isVi
    ? `Mã ${input.promoCode} đã kích hoạt — Sophia AI Factory`
    : `Code ${input.promoCode} activated — Sophia AI Factory`;

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

  return { subject, html };
}
