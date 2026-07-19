/**
 * Activation reminder email — Day 3 nudge if user logged in but never created their first video.
 * Distinct from `onboarding-nudge` (D+1, sent only when user hasn't logged in yet).
 *
 * @module lib/email/templates/activation-reminder
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface ActivationReminderData {
  ownerFullName: string;
  locale: string;
  /** Optional: number of days since signup, used in copy. */
  daysSinceSignup?: number;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderActivationReminder(data: ActivationReminderData): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const newVideoUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/videos/new`;
  const guideUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/guide`;

  const subject = isVi
    ? 'Tạo video AI đầu tiên của bạn — chỉ cần 5 phút'
    : 'Create your first AI video — only 5 minutes';

  const greeting = isVi ? `Xin chào ${name},` : `Hello ${name},`;
  const body = isVi
    ? `Bạn đã đăng nhập Sophia AI Factory rồi — tốt lắm! Bước tiếp theo: tạo <strong>video AI đầu tiên</strong>. Chỉ cần một câu prompt, bạn sẽ có video chất lượng cao trong vài phút.`
    : `You're logged into Sophia AI Factory — great! Next step: create your <strong>first AI video</strong>. Just one prompt and you'll have a high-quality video in minutes.`;

  const stepsTitle = isVi ? '3 bước đơn giản:' : '3 simple steps:';
  const steps = isVi
    ? [
        'Mở Dashboard → "Tạo Video Mới"',
        'Nhập prompt mô tả video (vd: "5 mẹo dùng ChatGPT cho creator")',
        'Chọn voice + style → click Generate',
      ]
    : [
        'Open Dashboard → "New Video"',
        'Enter a prompt (e.g. "5 ChatGPT tips for creators")',
        'Pick a voice + style → click Generate',
      ];

  const ctaPrimary = isVi ? 'Tạo Video Đầu Tiên' : 'Create First Video';
  const ctaSecondary = isVi ? 'Đọc hướng dẫn nhanh' : 'Read quick guide';
  const helpText = isVi
    ? 'Cần hỗ trợ? Reply email này hoặc chat @Sophia_Bbot trên Telegram.'
    : "Need help? Reply to this email or message @Sophia_Bbot on Telegram.";

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6">${body}</p>
    ${ctaButton(ctaPrimary, newVideoUrl, 'linear-gradient(135deg,#06b6d4,#7c3aed)')}
    <p style="margin:16px 0 0;text-align:center"><a href="${guideUrl}" style="color:#a1a1aa;font-size:13px">${ctaSecondary} →</a></p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="font-size:13px;color:#a1a1aa;margin:0 0 8px"><strong>${stepsTitle}</strong></p>
    <ol style="color:#d4d4d8;font-size:13px;padding-left:20px;margin:0 0 24px;line-height:2">
      ${steps.map((s) => `<li>${s}</li>`).join('')}
    </ol>
    <p style="color:#71717a;font-size:13px;margin:0">${helpText}</p>`;

  const html = htmlWrapper(content, 'rgba(6,182,212,0.10)');
  return { html, text: htmlToText(html), subject };
}
