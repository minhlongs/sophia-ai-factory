/**
 * Post-purchase activation nudge email — sent 2h after purchase if Setup Wizard
 * not yet completed (onboarding_completed_at IS NULL).
 * Bilingual EN + VI.
 *
 * @module forest/email/templates/post-purchase-nudge
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface PostPurchaseNudgeData {
  ownerFullName: string;
  locale: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderPostPurchaseNudge(data: PostPurchaseNudgeData): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const wizardUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/onboarding`;

  const subject = isVi
    ? 'Sophia đang chờ API keys của bạn — 3 bước đơn giản'
    : 'Sophia is waiting for your API keys — 3 simple steps';

  const greeting = isVi ? `Xin chào ${name},` : `Hello ${name},`;

  const reminder = isVi
    ? `Tài khoản của bạn đã được kích hoạt, nhưng chúng tôi chưa thấy bạn hoàn tất Setup Wizard. Chỉ cần <strong>3 bước</strong> là bạn đã sẵn sàng tạo video AI.`
    : `Your account is active, but Setup Wizard isn't done yet. Just <strong>3 steps</strong> and you're ready to generate AI videos.`;

  const stepsTitle = isVi ? '3 bước nhanh:' : '3 quick steps:';
  const steps = isVi
    ? [
        'Đăng nhập → mở Setup Wizard',
        'Nhập OpenRouter key + ElevenLabs key',
        'Click "Lưu" → hoàn tất!',
      ]
    : [
        'Log in → open Setup Wizard',
        'Enter your OpenRouter key + ElevenLabs key',
        'Click "Save" → done!',
      ];

  const ctaLabel = isVi ? 'Hoàn Tất Setup Ngay' : 'Complete Setup Now';

  const helpText = isVi
    ? 'Không có key? Xem hướng dẫn lấy key miễn phí trong 2 phút trong Setup Wizard.'
    : 'No keys yet? The Setup Wizard includes a guide to get free-tier keys in 2 minutes.';

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6;color:#d4d4d8">${reminder}</p>
    ${ctaButton(ctaLabel, wizardUrl, 'linear-gradient(135deg,#d97706,#7c3aed)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="font-size:13px;color:#a1a1aa;margin:0 0 8px"><strong>${stepsTitle}</strong></p>
    <ol style="color:#d4d4d8;font-size:13px;padding-left:20px;margin:0 0 24px;line-height:2">
      ${steps.map((s) => `<li>${s}</li>`).join('')}
    </ol>
    <p style="color:#71717a;font-size:13px;margin:0">${helpText}</p>`;

  const html = htmlWrapper(content, 'rgba(217,119,6,0.10)', 'rgba(124,58,237,0.10)', 'rgba(217,119,6,0.3)');
  return { html, text: htmlToText(html), subject };
}
