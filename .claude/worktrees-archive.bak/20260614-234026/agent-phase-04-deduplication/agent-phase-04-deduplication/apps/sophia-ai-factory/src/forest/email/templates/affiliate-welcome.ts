/**
 * Affiliate welcome email — Day 0 of affiliate onboarding sequence.
 * Sent immediately after a user opts into the affiliate program (referral code generated
 * via /api/referral/generate or first earnings event).
 *
 * Follow-up emails (Day 1 first-link tutorial, Day 7 case study) live in lifecycle-email-rules
 * extension — not yet implemented.
 *
 * @module lib/email/templates/affiliate-welcome
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface AffiliateWelcomeData {
  ownerFullName: string;
  referralCode: string;
  locale: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderAffiliateWelcome(data: AffiliateWelcomeData): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const dashboardUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/affiliate`;
  const referralLink = `${BASE_URL}/?ref=${encodeURIComponent(data.referralCode)}`;

  const subject = isVi
    ? 'Chào mừng affiliate Sophia — Mã giới thiệu của bạn đã sẵn sàng'
    : 'Welcome, Sophia affiliate — Your referral code is ready';

  const greeting = isVi ? `Xin chào ${name},` : `Hello ${name},`;
  const intro = isVi
    ? `Cảm ơn bạn đã tham gia chương trình affiliate Sophia AI Factory. Bạn nhận <strong>30% hoa hồng định kỳ</strong> trên mọi subscription bạn giới thiệu — không chỉ tháng đầu tiên.`
    : `Thanks for joining the Sophia AI Factory affiliate program. You earn <strong>30% recurring commission</strong> on every subscription you refer — not just the first month.`;

  const codeLabel = isVi ? 'Mã giới thiệu của bạn:' : 'Your referral code:';
  const linkLabel = isVi ? 'Link giới thiệu:' : 'Your referral link:';
  const ctaLabel = isVi ? 'Xem Dashboard Affiliate' : 'View Affiliate Dashboard';

  const tipsLabel = isVi ? 'Mẹo bắt đầu:' : 'Quick start tips:';
  const tips = isVi
    ? [
        'Chia sẻ link trên Twitter/X, blog, Telegram — nơi creator hay đọc',
        'Theo dõi conversion real-time trên dashboard',
        'USDT payouts tức thì khi đạt $50; fiat qua Stripe Connect (cần KYC)',
      ]
    : [
        'Share the link on Twitter/X, your blog, Telegram — wherever creators hang out',
        'Track conversions in real time from the dashboard',
        'Instant USDT payouts at $50; fiat via Stripe Connect (KYC required)',
      ];

  const helpText = isVi
    ? 'Câu hỏi? Reply email này hoặc nhắn @Sophia_Bbot trên Telegram.'
    : "Questions? Reply to this email or message @Sophia_Bbot on Telegram.";

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6">${intro}</p>
    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:8px;padding:16px;margin:0 0 16px">
      <p style="margin:0 0 4px;font-size:13px;color:#a1a1aa">${codeLabel}</p>
      <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:600;letter-spacing:0.05em">${data.referralCode}</p>
    </div>
    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:8px;padding:16px;margin:0 0 24px">
      <p style="margin:0 0 4px;font-size:13px;color:#a1a1aa">${linkLabel}</p>
      <p style="margin:0;word-break:break-all;font-size:13px"><a href="${referralLink}" style="color:#7c3aed">${referralLink}</a></p>
    </div>
    ${ctaButton(ctaLabel, dashboardUrl, 'linear-gradient(135deg,#7c3aed,#06b6d4)')}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="font-size:13px;color:#a1a1aa;margin:0 0 8px"><strong>${tipsLabel}</strong></p>
    <ol style="color:#d4d4d8;font-size:13px;padding-left:20px;margin:0 0 24px;line-height:2">
      ${tips.map((s) => `<li>${s}</li>`).join('')}
    </ol>
    <p style="color:#71717a;font-size:13px;margin:0">${helpText}</p>`;

  const html = htmlWrapper(content, 'rgba(124,58,237,0.12)');
  return { html, text: htmlToText(html), subject };
}
