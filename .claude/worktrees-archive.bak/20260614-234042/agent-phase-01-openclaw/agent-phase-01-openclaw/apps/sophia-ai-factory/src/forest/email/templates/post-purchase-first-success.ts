/**
 * First-success celebration email — sent after user's first video row is created.
 * Celebrates milestone, links to results dashboard, encourages sharing.
 * Bilingual EN + VI.
 *
 * @module forest/email/templates/post-purchase-first-success
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface PostPurchaseFirstSuccessData {
  ownerFullName: string;
  locale: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderPostPurchaseFirstSuccess(data: PostPurchaseFirstSuccessData): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const dashUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/videos`;

  const subject = isVi
    ? '🎉 Video AI đầu tiên của bạn đã hoàn tất!'
    : '🎉 Your first AI video is ready!';

  const greeting = isVi ? `${name},` : `${name},`;

  const celebration = isVi
    ? `Video AI đầu tiên của bạn đã được tạo thành công! Đây là bước quan trọng nhất — từ bây giờ bạn có thể tạo không giới hạn.`
    : `Your first AI video was just created successfully! This is the most important milestone — from here, you can generate without limits.`;

  const nextSteps = isVi
    ? `Xem kết quả, tải xuống, hoặc đăng thẳng lên social media từ dashboard của bạn.`
    : `View your results, download, or publish directly to social media from your dashboard.`;

  const shareCta = isVi
    ? `Chia sẻ thành công với team hoặc khách hàng của bạn — họ sẽ ấn tượng đấy.`
    : `Share this win with your team or clients — they'll be impressed.`;

  const ctaLabel = isVi ? 'Xem Video Của Bạn' : 'View Your Video';

  const telegramNote = isVi
    ? 'Muốn tạo thêm? Gửi /campaign cho @Sophia_Bbot trên Telegram bất cứ lúc nào.'
    : 'Want more? Send /campaign to @Sophia_Bbot on Telegram anytime.';

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 16px;line-height:1.6;color:#d4d4d8;font-size:18px;font-weight:600">${celebration}</p>
    <p style="margin:0 0 16px;line-height:1.6;color:#d4d4d8">${nextSteps}</p>
    ${ctaButton(ctaLabel, dashUrl, 'linear-gradient(135deg,#059669,#06b6d4)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 12px">${shareCta}</p>
    <p style="color:#71717a;font-size:13px;margin:0">${telegramNote}</p>`;

  const html = htmlWrapper(content, 'rgba(5,150,105,0.12)', 'rgba(6,182,212,0.12)', 'rgba(5,150,105,0.3)');
  return { html, text: htmlToText(html), subject };
}
