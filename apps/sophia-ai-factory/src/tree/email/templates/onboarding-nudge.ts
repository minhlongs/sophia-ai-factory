/**
 * D+1 onboarding nudge email — sent only if user hasn't logged in yet.
 * @module lib/email/templates/onboarding-nudge
 */

import { htmlWrapper, ctaButton, magicLinkNote, htmlToText } from './shared-layout';

export interface OnboardingNudgeData {
  ownerFullName: string;
  magicLinkUrl: string;
  locale: string;
}

export function renderOnboardingNudge(data: OnboardingNudgeData): { html: string; text: string; subject: string } {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;

  const subject = isVi
    ? 'Chúng tôi đang chờ bạn — Sophia AI Factory'
    : 'We\'re waiting for you — Sophia AI Factory';

  const greeting = isVi ? `Xin chào ${name},` : `Hello ${name},`;
  const body = isVi
    ? `Tài khoản Sophia AI Factory của bạn đã sẵn sàng từ hôm qua, nhưng chúng tôi chưa thấy bạn đăng nhập. Đừng bỏ lỡ cơ hội tự động hóa agency của bạn!`
    : `Your Sophia AI Factory account has been ready since yesterday, but we haven't seen you log in yet. Don't miss the chance to automate your agency workflows!`;
  const ctaLabel = isVi ? 'Truy Cập Ngay' : 'Access Now';
  const helpText = isVi
    ? 'Gặp vấn đề khi đăng nhập? Liên hệ chúng tôi — chúng tôi ở đây để giúp.'
    : 'Having trouble logging in? Reach out to us — we\'re here to help.';

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6">${body}</p>
    ${ctaButton(ctaLabel, data.magicLinkUrl, 'linear-gradient(135deg,#7c3aed,#2563eb)')}
    ${magicLinkNote(data.locale)}
    <p style="color:#71717a;font-size:13px;margin:0">${helpText}</p>`;

  const html = htmlWrapper(content);
  return { html, text: htmlToText(html), subject };
}
