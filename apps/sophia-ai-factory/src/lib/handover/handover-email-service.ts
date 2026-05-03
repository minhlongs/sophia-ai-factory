/**
 * Handover welcome email service.
 * Uses Resend (existing infra) to send the magic link + onboarding doc.
 * @module lib/handover/handover-email-service
 */

import { Resend } from 'resend';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';

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

/** Send welcome email with magic link to new customer */
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
