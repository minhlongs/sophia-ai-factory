/**
 * Win-back email — Day 60 after subscription cancelled.
 * Sent once. If user does not respond, the optional Day-90 reactivation
 * (separate template, not yet implemented) is the final touch.
 *
 * @module lib/email/templates/win-back
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface WinBackData {
  ownerFullName: string;
  locale: string;
  /** ISO date when subscription was cancelled (used in copy "since {date}") */
  cancelledAt: string;
  /** Optional discount code to entice return — e.g. 'COMEBACK30'. */
  discountCode?: string;
  /** Discount percent for copy display, e.g. 30 = 30% off first month. */
  discountPercent?: number;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderWinBack(data: WinBackData): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const pricingUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/pricing?utm_source=email&utm_campaign=winback&utm_medium=lifecycle`;
  const hasDiscount = !!(data.discountCode && data.discountPercent);

  const subject = hasDiscount
    ? isVi
      ? `Quay lại Sophia với ${data.discountPercent}% off — chỉ tháng đầu`
      : `Come back to Sophia — ${data.discountPercent}% off your first month`
    : isVi
      ? 'Chúng tôi nhớ bạn — Sophia có gì mới'
      : "We miss you — what's new at Sophia";

  const greeting = isVi ? `Xin chào ${name},` : `Hello ${name},`;
  const intro = isVi
    ? `Đã 60 ngày từ khi bạn rời Sophia AI Factory. Chúng tôi không gửi email lung tung — chỉ ping một lần để cập nhật những gì mới và xem bạn có muốn quay lại không.`
    : `It's been 60 days since you left Sophia AI Factory. We don't spam — this is a single ping to share what's new and see if you'd like to come back.`;

  const updatesTitle = isVi ? 'Cập nhật từ khi bạn rời:' : 'Since you left:';
  const updates = isVi
    ? [
        'Affiliate engine — kiếm 30% recurring khi giới thiệu creator',
        'Multi-channel publishing — TikTok, YouTube, Telegram',
        'Voice library mở rộng — 10+ giọng đọc preset',
        'Thanh toán fiat qua Stripe Connect (USDT vẫn instant)',
      ]
    : [
        'Affiliate engine — earn 30% recurring on creator referrals',
        'Multi-channel publishing — TikTok, YouTube, Telegram',
        'Expanded voice library — 10+ voice presets',
        'Fiat payouts via Stripe Connect (USDT still instant)',
      ];

  const discountBlock = hasDiscount
    ? `
    <div style="background:rgba(124,58,237,0.10);border:1px solid rgba(124,58,237,0.25);border-radius:8px;padding:20px;margin:0 0 16px;text-align:center">
      <p style="margin:0 0 6px;font-size:13px;color:#a1a1aa">${isVi ? 'Mã giảm giá đặc biệt:' : 'Your special code:'}</p>
      <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:22px;font-weight:700;letter-spacing:0.08em;color:#c084fc">${data.discountCode}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#d4d4d8">${isVi ? `${data.discountPercent}% off tháng đầu — áp dụng tại checkout` : `${data.discountPercent}% off your first month — apply at checkout`}</p>
    </div>`
    : '';

  const ctaLabel = isVi ? 'Xem Lại Pricing' : 'See Pricing';
  const noThanks = isVi
    ? 'Không quan tâm? Bạn có thể bỏ qua email này — chúng tôi không spam thêm.'
    : "Not interested? Feel free to ignore — we won't keep emailing you.";

  const cancelledMeta = isVi
    ? `Tài khoản hủy: ${data.cancelledAt}.`
    : `Subscription cancelled on ${data.cancelledAt}.`;

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6">${intro}</p>
    <p style="font-size:13px;color:#a1a1aa;margin:0 0 8px"><strong>${updatesTitle}</strong></p>
    <ul style="color:#d4d4d8;font-size:13px;padding-left:20px;margin:0 0 20px;line-height:2">
      ${updates.map((s) => `<li>${s}</li>`).join('')}
    </ul>
    ${discountBlock}
    ${ctaButton(ctaLabel, pricingUrl, 'linear-gradient(135deg,#7c3aed,#06b6d4)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:12px;margin:0 0 4px">${cancelledMeta}</p>
    <p style="color:#71717a;font-size:12px;margin:0">${noThanks}</p>`;

  const html = htmlWrapper(content, 'rgba(124,58,237,0.10)');
  return { html, text: htmlToText(html), subject };
}
