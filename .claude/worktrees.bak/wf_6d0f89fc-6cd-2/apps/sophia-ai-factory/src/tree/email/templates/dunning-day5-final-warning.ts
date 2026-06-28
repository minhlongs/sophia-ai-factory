/**
 * Dunning Day-5 email — "Your account will be suspended"
 *
 * Sent 120h after the first payment decline (final warning before suspension).
 * Communicates what features will be lost and provides a one-click retry link.
 *
 * @module forest/email/templates/dunning-day5-final-warning
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface DunningDay5Data {
  ownerFullName: string;
  locale: string;
  tierName: string;
  amountCents?: number;
  currency?: string;
  /** When suspension will take effect */
  suspensionDate?: Date;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderDunningDay5(data: DunningDay5Data): RenderedEmail {
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

  const subject = isVi
    ? `[Sophia AI] CẢNH BÁO CUỐI: Tài khoản ${tierDisplay} sẽ bị đình chỉ hôm nay`
    : `[Sophia AI] FINAL WARNING: Your ${tierDisplay} account will be suspended today`;

  const content = isVi
    ? buildViContent({ name, tierDisplay, amountStr, retryUrl, suspensionDateStr })
    : buildEnContent({ name, tierDisplay, amountStr, retryUrl, suspensionDateStr });

  const html = htmlWrapper(content, 'rgba(239,68,68,0.15)', 'rgba(239,68,68,0.08)', 'rgba(239,68,68,0.5)');
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
}

const EN_LOSSES: Record<string, string[]> = {
  BASIC:      ['AI video generation', 'Telegram bot commands', 'Campaign scheduler'],
  PREMIUM:    ['AI video generation', 'Telegram bot commands', 'Campaign scheduler', 'Priority rendering'],
  ENTERPRISE: ['AI video generation', 'Telegram bot commands', 'Campaign scheduler', 'Priority rendering', 'Advanced analytics', 'Affiliate dashboard'],
  MASTER:     ['AI video generation', 'Telegram bot commands', 'Campaign scheduler', 'Priority rendering', 'Advanced analytics', 'Affiliate dashboard', 'Custom branding', 'Dedicated support'],
};

const VI_LOSSES: Record<string, string[]> = {
  BASIC:      ['Tạo video AI', 'Lệnh Telegram bot', 'Lập lịch chiến dịch'],
  PREMIUM:    ['Tạo video AI', 'Lệnh Telegram bot', 'Lập lịch chiến dịch', 'Rendering ưu tiên'],
  ENTERPRISE: ['Tạo video AI', 'Lệnh Telegram bot', 'Lập lịch chiến dịch', 'Rendering ưu tiên', 'Phân tích nâng cao', 'Bảng điều khiển Affiliate'],
  MASTER:     ['Tạo video AI', 'Lệnh Telegram bot', 'Lập lịch chiến dịch', 'Rendering ưu tiên', 'Phân tích nâng cao', 'Bảng điều khiển Affiliate', 'Thương hiệu tùy chỉnh', 'Hỗ trợ riêng'],
};

function buildEnContent(p: ContentParams): string {
  const { name, tierDisplay, amountStr, retryUrl, suspensionDateStr } = p;
  const tierKey = tierDisplay.toUpperCase() as keyof typeof EN_LOSSES;
  const losses = (EN_LOSSES[tierKey] ?? EN_LOSSES.BASIC).map(l => `<li>${l}</li>`).join('');
  const amountLine = amountStr ? `<strong>${amountStr}</strong>` : 'your outstanding balance';
  const dateNote = suspensionDateStr
    ? `<p style="color:#fca5a5;margin:0 0 12px;font-weight:600">Suspension date: ${suspensionDateStr}</p>`
    : '';

  return `
    <p style="margin:0 0 16px">Hi ${name},</p>
    <div style="background:rgba(239,68,68,0.20);border:2px solid rgba(239,68,68,0.6);border-radius:10px;padding:20px;margin:0 0 20px">
      <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#fca5a5">🚨 Final Warning</p>
      ${dateNote}
      <p style="margin:0;font-size:14px;color:#fecaca">
        Your <strong>${tierDisplay}</strong> account will be <strong>suspended</strong> due to non-payment of ${amountLine}.
      </p>
    </div>
    <p style="margin:0 0 12px;font-size:14px;color:#a1a1aa">After suspension, you will <strong>immediately lose access</strong> to:</p>
    <ul style="color:#d4d4d8;font-size:14px;padding-left:20px;margin:0 0 20px;line-height:2">
      ${losses}
    </ul>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6">
      Pay now to keep your account active. Your data and campaign history are safe — we never delete them.
    </p>
    ${ctaButton('Pay Now — Prevent Suspension', retryUrl, 'linear-gradient(135deg,#ef4444,#dc2626)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:13px;margin:0">
      Already paid? It may take a few minutes to process. Questions?
      Reply to this email or message <a href="https://t.me/Sophia_Bbot" style="color:#a78bfa">@Sophia_Bbot</a>.
    </p>`;
}

function buildViContent(p: ContentParams): string {
  const { name, tierDisplay, amountStr, retryUrl, suspensionDateStr } = p;
  const tierKey = tierDisplay.toUpperCase() as keyof typeof VI_LOSSES;
  const losses = (VI_LOSSES[tierKey] ?? VI_LOSSES.BASIC).map(l => `<li>${l}</li>`).join('');
  const amountLine = amountStr ? `<strong>${amountStr}</strong>` : 'số tiền còn nợ';
  const dateNote = suspensionDateStr
    ? `<p style="color:#fca5a5;margin:0 0 12px;font-weight:600">Ngày đình chỉ: ${suspensionDateStr}</p>`
    : '';

  return `
    <p style="margin:0 0 16px">Xin chào ${name},</p>
    <div style="background:rgba(239,68,68,0.20);border:2px solid rgba(239,68,68,0.6);border-radius:10px;padding:20px;margin:0 0 20px">
      <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#fca5a5">🚨 Cảnh Báo Cuối Cùng</p>
      ${dateNote}
      <p style="margin:0;font-size:14px;color:#fecaca">
        Tài khoản <strong>${tierDisplay}</strong> của bạn sẽ bị <strong>đình chỉ</strong> do chưa thanh toán ${amountLine}.
      </p>
    </div>
    <p style="margin:0 0 12px;font-size:14px;color:#a1a1aa">Sau khi bị đình chỉ, bạn sẽ <strong>ngay lập tức mất quyền truy cập</strong> vào:</p>
    <ul style="color:#d4d4d8;font-size:14px;padding-left:20px;margin:0 0 20px;line-height:2">
      ${losses}
    </ul>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6">
      Thanh toán ngay để giữ tài khoản hoạt động. Dữ liệu và lịch sử chiến dịch của bạn an toàn — chúng tôi không bao giờ xóa.
    </p>
    ${ctaButton('Thanh Toán Ngay — Ngăn Chặn Đình Chỉ', retryUrl, 'linear-gradient(135deg,#ef4444,#dc2626)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:13px;margin:0">
      Đã thanh toán? Có thể mất vài phút để xử lý. Cần hỗ trợ?
      Reply email này hoặc nhắn tin <a href="https://t.me/Sophia_Bbot" style="color:#a78bfa">@Sophia_Bbot</a>.
    </p>`;
}
