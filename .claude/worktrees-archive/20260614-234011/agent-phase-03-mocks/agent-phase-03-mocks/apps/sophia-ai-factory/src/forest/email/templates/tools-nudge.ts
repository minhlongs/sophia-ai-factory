/**
 * D+4 tools-nudge email — sent to active users (logged in + first video done)
 * highlighting 3 power features they likely haven't tried yet.
 *
 * Distinct from `activation-reminder` (D+3, targets logged-in users with NO video)
 * and `onboarding-nudge` (D+1, targets users who never logged in).
 *
 * @module lib/email/templates/tools-nudge
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface ToolsNudgeData {
  ownerFullName: string;
  locale: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderToolsNudge(data: ToolsNudgeData): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const dashUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard`;
  const telegramUrl = 'https://t.me/Sophia_Bbot';
  const affiliateUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/affiliate`;

  const subject = isVi
    ? '3 công cụ Sophia bạn có thể đang bỏ lỡ'
    : '3 Sophia tools you might be ignoring';

  const greeting = isVi ? `Xin chào ${name},` : `Hi ${name},`;
  const intro = isVi
    ? `Bạn đã chạy video đầu tiên — tốt. Đây là 3 công cụ ít người dùng hết, nhưng mang giá trị lớn nhất:`
    : `You've shipped your first video — good. Here are 3 tools most users underuse but get the biggest return from:`;

  const tools = isVi
    ? [
        {
          title: 'Telegram bot — /campaign từ điện thoại',
          desc: 'Không cần mở dashboard. Gửi /campaign cho @Sophia_Bbot, chọn niche, video render trong vài phút. Test trong lúc đi cà phê.',
          cta: 'Mở Telegram bot →',
          url: telegramUrl,
        },
        {
          title: 'Affiliate dashboard — refer 1 khách = +30% commission',
          desc: 'Mỗi tài khoản trial có sẵn referral code. Share link → bạn của bạn signup → bạn nhận hoa hồng định kỳ. Không cần "bán" gì.',
          cta: 'Lấy referral code →',
          url: affiliateUrl,
        },
        {
          title: 'Bulk scheduling — chạy 5-10 video / tuần',
          desc: 'Một niche không đủ để test. Lên lịch chạy 5-10 niche / tuần, để analytics quyết định niche nào double-down.',
          cta: 'Lên lịch bulk →',
          url: `${dashUrl}/videos/new`,
        },
      ]
    : [
        {
          title: 'Telegram bot — /campaign from your phone',
          desc: 'No dashboard needed. Send /campaign to @Sophia_Bbot, pick a niche, video renders in minutes. Test it during a coffee break.',
          cta: 'Open Telegram bot →',
          url: telegramUrl,
        },
        {
          title: 'Affiliate dashboard — refer 1 customer = +30% commission',
          desc: 'Every trial account ships with a referral code. Share the link → your contact signs up → you earn recurring commission. No selling required.',
          cta: 'Grab your referral code →',
          url: affiliateUrl,
        },
        {
          title: 'Bulk scheduling — run 5-10 videos / week',
          desc: 'One niche is not enough to test. Schedule 5-10 niches / week, let the analytics tell you which one to double down on.',
          cta: 'Schedule a bulk batch →',
          url: `${dashUrl}/videos/new`,
        },
      ];

  const ctaLabel = isVi ? 'Mở Dashboard' : 'Open Dashboard';
  const closingNote = isVi
    ? 'Reply email nếu một trong các công cụ không hoạt động như mong đợi.'
    : 'Reply to this email if any of these tools is not behaving as expected.';

  const toolList = tools
    .map(
      (t) => `
      <div style="margin:0 0 20px;padding:16px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(255,255,255,0.02)">
        <p style="margin:0 0 6px;font-weight:600;color:#e4e4e7;font-size:14px">${t.title}</p>
        <p style="margin:0 0 10px;color:#a1a1aa;font-size:13px;line-height:1.6">${t.desc}</p>
        <a href="${t.url}" style="color:#a78bfa;font-size:13px;text-decoration:none;font-weight:500">${t.cta}</a>
      </div>`,
    )
    .join('');

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 20px;line-height:1.6;color:#d4d4d8">${intro}</p>
    ${toolList}
    ${ctaButton(ctaLabel, dashUrl, 'linear-gradient(135deg,#7c3aed,#2563eb)')}
    <p style="color:#71717a;font-size:13px;margin:16px 0 0">${closingNote}</p>`;

  const html = htmlWrapper(content, 'rgba(124,58,237,0.10)', 'rgba(37,99,235,0.10)');
  return { html, text: htmlToText(html), subject };
}
