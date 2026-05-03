/**
 * Welcome magic-link email template — purchase confirmed, first login prompt.
 * Replaces inline HTML in handover-email-service.ts.
 * @module lib/email/templates/welcome-magic-link
 */

import type { Tier } from '@/seed/types';
import { htmlWrapper, ctaButton, magicLinkNote, htmlToText, BASE_URL } from './shared-layout';

export interface WelcomeMagicLinkData {
  ownerFullName: string;
  tier: Tier;
  magicLinkUrl: string;
  locale: string;
  agencyName?: string;
}

export function renderWelcomeMagicLink(data: WelcomeMagicLinkData): { html: string; text: string; subject: string } {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const agencyName = data.agencyName ?? name;

  const subject = isVi
    ? `Tài khoản Sophia AI sẵn sàng — Gói ${data.tier}`
    : `Your Sophia AI account is ready — ${data.tier} plan`;

  const greeting = isVi ? `Xin chào ${name},` : `Hello ${name},`;
  const intro = isVi
    ? `Cảm ơn bạn đã mua gói <strong>${data.tier}</strong> của Sophia AI Factory! Tài khoản <strong>${agencyName}</strong> đã sẵn sàng.`
    : `Thank you for purchasing the <strong>${data.tier}</strong> plan! Your <strong>${agencyName}</strong> account is ready.`;
  const ctaLabel = isVi ? 'Truy Cập Ngay' : 'Access Your Account';
  const nextLabel = isVi ? 'Bước tiếp theo:' : 'Next steps:';
  const steps = isVi
    ? ['Click link → đặt mật khẩu', 'Hoàn thành onboarding 3 bước', 'Dashboard → SOPs → bật SOP đầu tiên', 'Run SOP → xem video tự tạo']
    : ['Click link → set password', 'Complete the 3-step onboarding', 'Dashboard → SOPs → enable first SOP', 'Run SOP → watch video generate'];

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6">${intro}</p>
    ${ctaButton(ctaLabel, data.magicLinkUrl, 'linear-gradient(135deg,#059669,#2563eb)')}
    ${magicLinkNote(data.locale)}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="font-size:13px;color:#a1a1aa;margin:0 0 8px"><strong>${nextLabel}</strong></p>
    <ol style="color:#d4d4d8;font-size:13px;padding-left:20px;margin:0 0 24px;line-height:2">
      ${steps.map(s => `<li>${s}</li>`).join('')}
    </ol>`;

  const html = htmlWrapper(
    content,
    'rgba(16,185,129,0.12)',
    'rgba(59,130,246,0.12)',
    'rgba(16,185,129,0.3)',
  );
  return { html, text: htmlToText(html), subject };
}
