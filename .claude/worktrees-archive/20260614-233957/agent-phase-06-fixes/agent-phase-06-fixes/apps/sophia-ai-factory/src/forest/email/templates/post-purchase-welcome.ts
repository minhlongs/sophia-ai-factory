/**
 * Post-purchase welcome email — sent immediately after IPN confirms payment.
 * Congratulates user on tier activation and directs them to the Setup Wizard.
 * Bilingual EN + VI.
 *
 * @module forest/email/templates/post-purchase-welcome
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';
import type { Tier } from '@/seed/types';

export interface PostPurchaseWelcomeData {
  ownerFullName: string;
  tier: Tier;
  locale: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderPostPurchaseWelcome(data: PostPurchaseWelcomeData): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const tierLabel = data.tier;
  const wizardUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/onboarding`;

  const subject = isVi
    ? `Chào mừng đến với ${tierLabel} — Thiết lập trong 5 phút`
    : `Welcome to ${tierLabel} — Setup in 5 minutes`;

  const greeting = isVi ? `Xin chào ${name},` : `Hello ${name},`;

  const congrats = isVi
    ? `Thanh toán thành công! Tài khoản <strong>${tierLabel}</strong> của bạn đã được kích hoạt ngay lập tức.`
    : `Payment confirmed! Your <strong>${tierLabel}</strong> account is now active.`;

  const setupPromise = isVi
    ? `Một bước cuối: nhập API keys của bạn vào Setup Wizard — chỉ mất <strong>5-10 phút</strong>. Sau đó bạn có thể tạo video AI đầu tiên ngay.`
    : `One last step: enter your API keys in the Setup Wizard — takes only <strong>5-10 minutes</strong>. After that you can create your first AI video immediately.`;

  const ctaLabel = isVi ? 'Mở Setup Wizard' : 'Open Setup Wizard';

  const signoff = isVi
    ? 'Gặp vấn đề? Reply email này hoặc nhắn @Sophia_Bbot trên Telegram.'
    : 'Questions? Reply to this email or message @Sophia_Bbot on Telegram.';

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 16px;line-height:1.6;color:#d4d4d8">${congrats}</p>
    <p style="margin:0 0 24px;line-height:1.6;color:#d4d4d8">${setupPromise}</p>
    ${ctaButton(ctaLabel, wizardUrl, 'linear-gradient(135deg,#7c3aed,#06b6d4)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:13px;margin:0">${signoff}</p>`;

  const html = htmlWrapper(content, 'rgba(124,58,237,0.12)', 'rgba(6,182,212,0.12)', 'rgba(124,58,237,0.3)');
  return { html, text: htmlToText(html), subject };
}
