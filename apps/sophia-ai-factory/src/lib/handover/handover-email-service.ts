/**
 * Handover welcome email service.
 * Uses Resend (existing infra) to send the magic link + onboarding doc.
 * @module lib/handover/handover-email-service
 */

import { Resend } from 'resend';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';

// ── Auto-handover email inputs ────────────────────────────────────────────────

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

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function buildWelcomeHtml(input: WelcomeEmailInput): string {
  const isVi = input.locale.startsWith('vi');
  const greeting = isVi
    ? `Xin chào ${input.ownerFullName},`
    : `Hello ${input.ownerFullName},`;
  const intro = isVi
    ? `Chào mừng bạn đến với <strong>Sophia AI Factory</strong>! Tài khoản <strong>${input.agencyName}</strong> (gói ${input.tier}) đã được tạo thành công.`
    : `Welcome to <strong>Sophia AI Factory</strong>! Your <strong>${input.agencyName}</strong> account (${input.tier} plan) has been created.`;
  const ctaLabel = isVi ? 'Truy Cập Sophia Ngay' : 'Access Sophia Now';
  const note = isVi
    ? 'Link này chỉ dùng 1 lần và hết hạn sau 24 giờ.'
    : 'This link is one-time use and expires in 24 hours.';
  const supportLabel = isVi ? 'Hỗ trợ' : 'Support';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#e4e4e7;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.15));border:1px solid rgba(139,92,246,0.3);border-radius:16px;padding:32px">
      <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
        Sophia AI Factory
      </h1>
      <p style="color:#a1a1aa;margin:0 0 24px;font-size:14px">AI Video Factory Platform</p>
      <p style="margin:0 0 16px">${greeting}</p>
      <p style="margin:0 0 24px;line-height:1.6">${intro}</p>
      <a href="${input.magicLinkUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:16px">
        ${ctaLabel}
      </a>
      <p style="color:#71717a;font-size:13px;margin:8px 0 24px">${note}</p>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
      <p style="color:#a1a1aa;font-size:13px;margin:0">
        ${supportLabel}: <a href="mailto:support@mekongmind.com" style="color:#a78bfa">support@mekongmind.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/** Send welcome email with magic link to new customer (admin-wizard variant) */
export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<{
  success: boolean;
  emailId?: string;
  error?: string;
}> {
  const resend = getResendClient();
  const isVi = input.locale.startsWith('vi');
  const subject = isVi
    ? `Chào mừng đến Sophia AI — ${input.agencyName}`
    : `Welcome to Sophia AI — ${input.agencyName}`;

  const html = buildWelcomeHtml(input);

  if (!resend) {
    logger.info('[HandoverEmail] Resend not configured — logging email only', {
      to: input.toEmail,
      subject,
    });
    return { success: true, emailId: 'logged-only' };
  }

  try {
    const result = await resend.emails.send({
      from: 'Sophia AI <noreply@mekongmind.com>',
      to: [input.toEmail],
      subject,
      html,
    });

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

// ── Auto-payment welcome email ────────────────────────────────────────────────

function buildAutoWelcomeHtml(input: AutoWelcomeEmailInput): string {
  const isVi = input.locale.startsWith('vi');
  const greeting = isVi ? `Xin chào ${input.ownerFullName},` : `Hello ${input.ownerFullName},`;
  const intro = isVi
    ? `Cảm ơn bạn đã mua gói <strong>${input.tier}</strong> của Sophia AI Factory! Tài khoản của bạn đã sẵn sàng.`
    : `Thank you for purchasing the <strong>${input.tier}</strong> plan on Sophia AI Factory! Your account is ready.`;
  const ctaLabel = isVi ? 'Truy Cập Ngay' : 'Access Your Account';
  const note = isVi ? 'Link chỉ dùng 1 lần, hết hạn sau 24 giờ.' : 'One-time use link, expires in 24 hours.';
  const step1 = isVi ? 'Click link → đặt mật khẩu' : 'Click link → set password';
  const step2 = isVi ? 'Settings → API Keys → thêm HeyGen key' : 'Settings → API Keys → add HeyGen key';
  const step3 = isVi ? 'Dashboard → SOPs → bật SOP đầu tiên' : 'Dashboard → SOPs → enable first SOP';
  const step4 = isVi ? 'Run SOP → xem video tự tạo' : 'Run SOP → watch video generate';
  const nextLabel = isVi ? 'Bước tiếp theo:' : 'Next steps:';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#e4e4e7;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(59,130,246,0.12));border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:32px">
      <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;background:linear-gradient(135deg,#34d399,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Sophia AI Factory</h1>
      <p style="color:#a1a1aa;margin:0 0 24px;font-size:14px">${isVi ? 'Xác nhận thanh toán' : 'Purchase Confirmation'}</p>
      <p style="margin:0 0 16px">${greeting}</p>
      <p style="margin:0 0 24px;line-height:1.6">${intro}</p>
      <a href="${input.magicLinkUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#2563eb);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:16px">${ctaLabel}</a>
      <p style="color:#71717a;font-size:13px;margin:8px 0 24px">${note}</p>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
      <p style="font-size:13px;color:#a1a1aa;margin:0 0 8px"><strong>${nextLabel}</strong></p>
      <ol style="color:#d4d4d8;font-size:13px;padding-left:20px;margin:0 0 24px;line-height:2">
        <li>${step1}</li><li>${step2}</li><li>${step3}</li><li>${step4}</li>
      </ol>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:0 0 16px">
      <p style="color:#a1a1aa;font-size:13px;margin:0">${isVi ? 'Hỗ trợ' : 'Support'}: <a href="mailto:support@mekongmind.com" style="color:#34d399">support@mekongmind.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

/** Send auto-payment welcome email (purchase-confirmed framing, not admin-wizard framing). */
export async function sendAutoHandoverWelcomeEmail(input: AutoWelcomeEmailInput): Promise<void> {
  const resend = getResendClient();
  const isVi = input.locale.startsWith('vi');
  const subject = isVi
    ? `Tài khoản Sophia AI sẵn sàng — Gói ${input.tier}`
    : `Your Sophia AI account is ready — ${input.tier} plan`;

  if (!resend) {
    logger.info('[HandoverEmail] Auto welcome — Resend not configured', { to: input.toEmail });
    return;
  }

  try {
    const result = await resend.emails.send({
      from: 'Sophia AI <noreply@mekongmind.com>',
      to: [input.toEmail],
      subject,
      html: buildAutoWelcomeHtml(input),
    });
    logger.info('[HandoverEmail] Auto welcome sent', { emailId: result.data?.id, to: input.toEmail });
  } catch (err) {
    logger.warn('[HandoverEmail] Auto welcome send failed', { to: input.toEmail, error: err instanceof Error ? err.message : String(err) });
  }
}

// ── Tier upgrade email ────────────────────────────────────────────────────────

/** Send tier-upgrade notification to existing customer. */
export async function sendTierUpgradeEmail(input: TierUpgradeEmailInput): Promise<void> {
  const resend = getResendClient();
  const isVi = input.locale.startsWith('vi');
  const subject = isVi
    ? `Bạn đã nâng cấp lên gói ${input.newTier} — Sophia AI`
    : `You've upgraded to ${input.newTier} — Sophia AI`;

  const greeting = isVi ? `Xin chào ${input.ownerFullName},` : `Hello ${input.ownerFullName},`;
  const body = isVi
    ? `Tài khoản của bạn đã được nâng cấp lên gói <strong>${input.newTier}</strong>. Các tính năng mới đã được kích hoạt ngay lập tức.`
    : `Your account has been upgraded to the <strong>${input.newTier}</strong> plan. New features are unlocked immediately.`;
  const ctaLabel = isVi ? 'Xem Dashboard' : 'Go to Dashboard';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#e4e4e7;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(139,92,246,0.12));border:1px solid rgba(245,158,11,0.3);border-radius:16px;padding:32px">
      <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;background:linear-gradient(135deg,#f59e0b,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Sophia AI Factory</h1>
      <p style="margin:0 0 16px">${greeting}</p>
      <p style="margin:0 0 24px;line-height:1.6">${body}</p>
      <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#d97706,#7c3aed);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${ctaLabel}</a>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
      <p style="color:#a1a1aa;font-size:13px;margin:0">${isVi ? 'Hỗ trợ' : 'Support'}: <a href="mailto:support@mekongmind.com" style="color:#f59e0b">support@mekongmind.com</a></p>
    </div>
  </div>
</body>
</html>`;

  if (!resend) {
    logger.info('[HandoverEmail] Tier upgrade — Resend not configured', { to: input.toEmail });
    return;
  }

  try {
    const result = await resend.emails.send({
      from: 'Sophia AI <noreply@mekongmind.com>',
      to: [input.toEmail],
      subject,
      html,
    });
    logger.info('[HandoverEmail] Tier upgrade email sent', { emailId: result.data?.id, to: input.toEmail });
  } catch (err) {
    logger.warn('[HandoverEmail] Tier upgrade send failed', { to: input.toEmail, error: err instanceof Error ? err.message : String(err) });
  }
}
