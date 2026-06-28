/**
 * E2 setup-complete email — sent ONCE per user, immediately after the Setup
 * Wizard finalizes (first save-credentials POST that flips
 * `onboarding_completed_at` from NULL to a timestamp).
 *
 * Event-triggered (NOT cron). Idempotency enforced by `lifecycle_email_log`
 * dedup at the call site.
 *
 * @module lib/email/templates/setup-complete
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface SetupCompleteData {
  ownerFullName: string;
  locale: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderSetupComplete(data: SetupCompleteData): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const telegramUrl = 'https://t.me/Sophia_Bbot';
  const newCampaignUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/new-campaign`;
  const dashUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard`;

  const subject = isVi
    ? '4 ✅. Chạy chiến dịch đầu tiên.'
    : '4 ✅. Run your first campaign.';

  const greeting = isVi ? `${name},` : `${name},`;
  const intro = isVi
    ? `Cả 4 API keys đã xác thực. Bạn đã sẵn sàng.`
    : `All 4 API keys validated. You're ready.`;

  const fastPath = isVi
    ? `Cách nhanh nhất: gửi <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:monospace">/campaign</code> cho <a href="${telegramUrl}" style="color:#a78bfa">@Sophia_Bbot</a> trên Telegram. Chọn "video:create" → nhập niche/topic → xem.`
    : `Quickest path: send <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:monospace">/campaign</code> to <a href="${telegramUrl}" style="color:#a78bfa">@Sophia_Bbot</a> on Telegram. Pick "video:create" → enter your niche/topic → watch.`;

  const dashPath = isVi
    ? `Hoặc qua dashboard:`
    : `Or via dashboard:`;

  const costNote = isVi
    ? `Video đầu tiên thường mất <strong>3-5 phút</strong>. Chi phí: <strong>~$0.50-$1.50</strong> từ provider credits của bạn (Sophia không thu phí phần này — BYOK keys của bạn chi trả).`
    : `First video typically takes <strong>3-5 minutes</strong>. Cost: <strong>~$0.50-$1.50</strong> from your provider credits (Sophia doesn't charge for this — your BYOK keys do).`;

  const ctaPrimary = isVi ? 'Tạo chiến dịch đầu tiên' : 'Create first campaign';
  const ctaSecondary = isVi ? 'Hoặc mở dashboard →' : 'Or open dashboard →';
  const signoff = isVi ? '— Sophia team' : '— The Sophia team';

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 16px;line-height:1.6;color:#d4d4d8">${intro}</p>
    <p style="margin:0 0 16px;line-height:1.6;color:#d4d4d8">${fastPath}</p>
    <p style="margin:0 0 12px;line-height:1.6;color:#a1a1aa;font-size:14px">${dashPath}</p>
    ${ctaButton(ctaPrimary, newCampaignUrl, 'linear-gradient(135deg,#06b6d4,#7c3aed)')}
    <p style="margin:12px 0 0;text-align:center"><a href="${dashUrl}" style="color:#a1a1aa;font-size:13px">${ctaSecondary}</a></p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="margin:0 0 16px;line-height:1.6;color:#a1a1aa;font-size:13px">${costNote}</p>
    <p style="margin:0;color:#71717a;font-size:13px">${signoff}</p>`;

  const html = htmlWrapper(content, 'rgba(6,182,212,0.10)', 'rgba(124,58,237,0.10)');
  return { html, text: htmlToText(html), subject };
}
