/**
 * Dunning Day-1 email — "Your payment didn't go through"
 *
 * Sent 24h after the first payment decline. Friendly tone, includes
 * tier name, amount, and retry deep-link to /dashboard/billing?retry=true.
 *
 * @module forest/email/templates/dunning-day1-payment-failed
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface DunningDay1Data {
  ownerFullName: string;
  locale: string;
  tierName: string;
  /** Amount in cents (e.g. 4900 = $49.00) */
  amountCents?: number;
  currency?: string;
  failureReason?: string;
  nextRetryDate?: Date;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderDunningDay1(data: DunningDay1Data): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const tierDisplay = data.tierName.charAt(0).toUpperCase() + data.tierName.slice(1).toLowerCase();
  const retryUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/billing?retry=true`;
  const amountStr = data.amountCents
    ? `${(data.amountCents / 100).toFixed(2)} ${(data.currency || 'USD').toUpperCase()}`
    : '';
  const retryDateStr = data.nextRetryDate
    ? (isVi
        ? data.nextRetryDate.toLocaleDateString('vi-VN')
        : data.nextRetryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    : '';

  const subject = isVi
    ? `[Sophia AI] Thanh toán ${tierDisplay} không thành công — vui lòng thử lại`
    : `[Sophia AI] Your ${tierDisplay} payment didn't go through`;

  const content = isVi
    ? buildViContent({ name, tierDisplay, amountStr, retryUrl, retryDateStr, failureReason: data.failureReason })
    : buildEnContent({ name, tierDisplay, amountStr, retryUrl, retryDateStr, failureReason: data.failureReason });

  const html = htmlWrapper(content, 'rgba(234,179,8,0.10)', 'rgba(234,179,8,0.05)', 'rgba(234,179,8,0.3)');
  return { html, text: htmlToText(html), subject };
}

// -------------------------------------------------------------------------
// Content builders
// -------------------------------------------------------------------------

interface ContentParams {
  name: string;
  tierDisplay: string;
  amountStr: string;
  retryUrl: string;
  retryDateStr: string;
  failureReason?: string;
}

function buildEnContent(p: ContentParams): string {
  const { name, tierDisplay, amountStr, retryUrl, retryDateStr, failureReason } = p;
  const reasonNote = failureReason
    ? `<p style="color:#a1a1aa;font-size:13px;margin:0 0 8px"><strong>Reason:</strong> ${failureReason}</p>`
    : '';
  const retryNote = retryDateStr
    ? `<p style="color:#a1a1aa;font-size:13px;margin:0 0 16px">We'll automatically retry on <strong>${retryDateStr}</strong>. You can also update your payment now to avoid any interruption.</p>`
    : `<p style="color:#a1a1aa;font-size:13px;margin:0 0 16px">Please update your payment method to avoid interruption.</p>`;
  const amountLine = amountStr
    ? `<p style="color:#a1a1aa;font-size:13px;margin:0 0 8px"><strong>Amount:</strong> ${amountStr}</p>`
    : '';

  return `
    <p style="margin:0 0 16px">Hi ${name},</p>
    <p style="margin:0 0 24px;line-height:1.6">
      We weren't able to process your <strong>Sophia AI ${tierDisplay}</strong> subscription payment.
      Don't worry — your account is still active while we sort this out.
    </p>
    ${amountLine}
    ${reasonNote}
    ${retryNote}
    ${ctaButton('Update Payment Method', retryUrl, 'linear-gradient(135deg,#eab308,#f97316)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:13px;margin:0">
      Need help? Reply to this email or message
      <a href="https://t.me/Sophia_Bbot" style="color:#a78bfa">@Sophia_Bbot</a> on Telegram.
    </p>`;
}

function buildViContent(p: ContentParams): string {
  const { name, tierDisplay, amountStr, retryUrl, retryDateStr, failureReason } = p;
  const reasonNote = failureReason
    ? `<p style="color:#a1a1aa;font-size:13px;margin:0 0 8px"><strong>Lý do:</strong> ${failureReason}</p>`
    : '';
  const retryNote = retryDateStr
    ? `<p style="color:#a1a1aa;font-size:13px;margin:0 0 16px">Chúng tôi sẽ tự động thử lại vào <strong>${retryDateStr}</strong>. Bạn cũng có thể cập nhật thông tin thanh toán ngay để tránh gián đoạn dịch vụ.</p>`
    : `<p style="color:#a1a1aa;font-size:13px;margin:0 0 16px">Vui lòng cập nhật phương thức thanh toán để tránh gián đoạn dịch vụ.</p>`;
  const amountLine = amountStr
    ? `<p style="color:#a1a1aa;font-size:13px;margin:0 0 8px"><strong>Số tiền:</strong> ${amountStr}</p>`
    : '';

  return `
    <p style="margin:0 0 16px">Xin chào ${name},</p>
    <p style="margin:0 0 24px;line-height:1.6">
      Chúng tôi không thể xử lý thanh toán gói <strong>Sophia AI ${tierDisplay}</strong> của bạn.
      Đừng lo — tài khoản của bạn vẫn đang hoạt động trong khi chúng tôi giải quyết vấn đề này.
    </p>
    ${amountLine}
    ${reasonNote}
    ${retryNote}
    ${ctaButton('Cập Nhật Phương Thức Thanh Toán', retryUrl, 'linear-gradient(135deg,#eab308,#f97316)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:13px;margin:0">
      Cần hỗ trợ? Reply email này hoặc nhắn tin
      <a href="https://t.me/Sophia_Bbot" style="color:#a78bfa">@Sophia_Bbot</a> trên Telegram.
    </p>`;
}
