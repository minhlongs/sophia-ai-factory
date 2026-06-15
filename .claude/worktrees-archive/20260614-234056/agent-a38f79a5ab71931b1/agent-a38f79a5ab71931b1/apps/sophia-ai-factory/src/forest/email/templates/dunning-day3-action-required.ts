/**
 * Dunning Day-3 email — "Action required: update your payment"
 *
 * Sent 72h after the first payment decline. Urgent tone: countdown to
 * suspension, retry deep-link to /dashboard/billing?retry=true.
 *
 * @module forest/email/templates/dunning-day3-action-required
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface DunningDay3Data {
  ownerFullName: string;
  locale: string;
  tierName: string;
  amountCents?: number;
  currency?: string;
  /** ISO string or Date — when service will be suspended if unpaid */
  suspensionDate?: Date;
  gracePeriodDaysLeft?: number;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderDunningDay3(data: DunningDay3Data): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const tierDisplay = data.tierName.charAt(0).toUpperCase() + data.tierName.slice(1).toLowerCase();
  const retryUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/billing?retry=true`;
  const amountStr = data.amountCents
    ? `${(data.amountCents / 100).toFixed(2)} ${(data.currency || 'USD').toUpperCase()}`
    : '';
  const suspensionDateStr = data.suspensionDate
    ? (isVi
        ? data.suspensionDate.toLocaleDateString('vi-VN')
        : data.suspensionDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    : '';
  const daysLeft = data.gracePeriodDaysLeft ?? 2;

  const subject = isVi
    ? `[Sophia AI] Hành động bắt buộc: cập nhật thanh toán ${tierDisplay} trong ${daysLeft} ngày`
    : `[Sophia AI] Action required: update your ${tierDisplay} payment (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`;

  const content = isVi
    ? buildViContent({ name, tierDisplay, amountStr, retryUrl, suspensionDateStr, daysLeft })
    : buildEnContent({ name, tierDisplay, amountStr, retryUrl, suspensionDateStr, daysLeft });

  const html = htmlWrapper(content, 'rgba(249,115,22,0.12)', 'rgba(239,68,68,0.08)', 'rgba(249,115,22,0.4)');
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
  suspensionDateStr: string;
  daysLeft: number;
}

function buildEnContent(p: ContentParams): string {
  const { name, tierDisplay, amountStr, retryUrl, suspensionDateStr, daysLeft } = p;
  const amountLine = amountStr
    ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
        <span style="color:#a1a1aa">Amount due:</span>
        <span style="font-weight:600">${amountStr}</span>
      </div>`
    : '';
  const suspensionLine = suspensionDateStr
    ? `<div style="display:flex;justify-content:space-between;padding:8px 0">
        <span style="color:#a1a1aa">Suspension date:</span>
        <span style="color:#f97316;font-weight:600">${suspensionDateStr}</span>
      </div>`
    : '';
  const countdown = daysLeft === 1
    ? `<strong>Only 1 day left</strong> before your ${tierDisplay} subscription is suspended.`
    : `<strong>Only ${daysLeft} days left</strong> before your ${tierDisplay} subscription is suspended.`;

  return `
    <p style="margin:0 0 16px">Hi ${name},</p>
    <div style="background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.4);border-radius:10px;padding:16px;margin:0 0 20px">
      <p style="margin:0;font-size:15px;color:#fed7aa">⚠️ ${countdown}</p>
    </div>
    <p style="margin:0 0 16px;line-height:1.6">
      Your <strong>Sophia AI ${tierDisplay}</strong> account has an outstanding payment.
      Update your payment method now to keep your campaigns running without interruption.
    </p>
    ${(amountLine || suspensionLine)
      ? `<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px 16px;margin:0 0 20px">${amountLine}${suspensionLine}</div>`
      : ''}
    ${ctaButton('Pay Now — Keep My Account', retryUrl, 'linear-gradient(135deg,#f97316,#ef4444)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:13px;margin:0">
      Questions? Reply to this email or message
      <a href="https://t.me/Sophia_Bbot" style="color:#a78bfa">@Sophia_Bbot</a> on Telegram.
    </p>`;
}

function buildViContent(p: ContentParams): string {
  const { name, tierDisplay, amountStr, retryUrl, suspensionDateStr, daysLeft } = p;
  const amountLine = amountStr
    ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
        <span style="color:#a1a1aa">Số tiền cần thanh toán:</span>
        <span style="font-weight:600">${amountStr}</span>
      </div>`
    : '';
  const suspensionLine = suspensionDateStr
    ? `<div style="display:flex;justify-content:space-between;padding:8px 0">
        <span style="color:#a1a1aa">Ngày đình chỉ:</span>
        <span style="color:#f97316;font-weight:600">${suspensionDateStr}</span>
      </div>`
    : '';
  const countdown = daysLeft === 1
    ? `Chỉ còn <strong>1 ngày</strong> trước khi tài khoản ${tierDisplay} của bạn bị đình chỉ.`
    : `Chỉ còn <strong>${daysLeft} ngày</strong> trước khi tài khoản ${tierDisplay} của bạn bị đình chỉ.`;

  return `
    <p style="margin:0 0 16px">Xin chào ${name},</p>
    <div style="background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.4);border-radius:10px;padding:16px;margin:0 0 20px">
      <p style="margin:0;font-size:15px;color:#fed7aa">⚠️ ${countdown}</p>
    </div>
    <p style="margin:0 0 16px;line-height:1.6">
      Tài khoản <strong>Sophia AI ${tierDisplay}</strong> của bạn có khoản thanh toán chưa hoàn thành.
      Cập nhật phương thức thanh toán ngay để các chiến dịch của bạn tiếp tục hoạt động.
    </p>
    ${(amountLine || suspensionLine)
      ? `<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px 16px;margin:0 0 20px">${amountLine}${suspensionLine}</div>`
      : ''}
    ${ctaButton('Thanh Toán Ngay — Giữ Tài Khoản', retryUrl, 'linear-gradient(135deg,#f97316,#ef4444)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:13px;margin:0">
      Cần hỗ trợ? Reply email này hoặc nhắn tin
      <a href="https://t.me/Sophia_Bbot" style="color:#a78bfa">@Sophia_Bbot</a> trên Telegram.
    </p>`;
}
