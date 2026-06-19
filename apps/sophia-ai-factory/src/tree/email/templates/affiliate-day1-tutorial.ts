/**
 * Affiliate Day-1 first-link tutorial — Day 1 of affiliate onboarding sequence.
 * Sent ~24h after enrollment; teaches *how* to deploy the referral code.
 *
 * @module lib/email/templates/affiliate-day1-tutorial
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface AffiliateDay1Data {
  ownerFullName: string;
  referralCode: string;
  locale: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderAffiliateDay1Tutorial(data: AffiliateDay1Data): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const localePath = isVi ? 'vi' : 'en';
  const referralLink = `${BASE_URL}/?ref=${encodeURIComponent(data.referralCode)}`;
  const dashboardUrl = `${BASE_URL}/${localePath}/dashboard/affiliate`;

  const subject = isVi
    ? 'Cách deploy link affiliate trong 5 phút — Sophia AI Factory'
    : 'Deploy your affiliate link in 5 minutes — Sophia AI Factory';

  const greeting = isVi ? `Xin chào ${data.ownerFullName},` : `Hello ${data.ownerFullName},`;

  const intro = isVi
    ? `Hôm qua bạn nhận mã giới thiệu. Hôm nay 5 phút để có conversion đầu tiên — đây là playbook nhanh.`
    : `Yesterday you got your referral code. Today, 5 minutes to your first conversion — here is the playbook.`;

  const stepsLabel = isVi ? '3 bước cụ thể:' : '3 concrete steps:';
  const steps = isVi
    ? [
        '<strong>Bước 1 — Chọn 1 nền tảng</strong>: Twitter/X, blog, Telegram channel, hoặc Discord. Đừng spread thin.',
        '<strong>Bước 2 — Viết 1 post hữu ích</strong>: chia sẻ vấn đề bạn từng gặp + Sophia giải quyết thế nào. Kèm link.',
        '<strong>Bước 3 — Pin/ghim post</strong>: Tweet ghim, blog homepage, Telegram pinned message.',
      ]
    : [
        '<strong>Step 1 — Pick ONE channel</strong>: Twitter/X, blog, Telegram, or Discord. Do not spread thin.',
        '<strong>Step 2 — Write 1 useful post</strong>: share a problem you had + how Sophia solved it. Include the link.',
        '<strong>Step 3 — Pin it</strong>: pinned tweet, blog homepage, Telegram pinned message.',
      ];

  const copyLabel = isVi ? 'Copy template (paste-ready):' : 'Copy template (paste-ready):';
  const copyTemplate = isVi
    ? `Mình dùng Sophia AI Factory để tự động hóa video TikTok/Reels. Tiết kiệm ~10h/tuần. Có code creator: ${referralLink}`
    : `I use Sophia AI Factory to automate TikTok/Reels video gen. Saves ~10h/week. Creator code: ${referralLink}`;

  const nicheLabel = isVi ? 'Niche dễ convert:' : 'Niches that convert easily:';
  const niches = isVi
    ? ['Content creator solo', 'Marketing agency owner', 'Coach / online educator', 'E-commerce dropshipper']
    : ['Solo content creators', 'Marketing agency owners', 'Coaches / online educators', 'E-commerce dropshippers'];

  const ctaLabel = isVi ? 'Mở Dashboard Affiliate' : 'Open Affiliate Dashboard';

  const helpText = isVi
    ? 'Bí kíp: post lúc 9h sáng giờ Mỹ (creator US online). Reply email nếu cần feedback bài viết của bạn.'
    : 'Pro tip: post at 9am US time (when US creators are online). Reply if you want feedback on your draft.';

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6">${intro}</p>

    <p style="font-size:14px;color:#d4d4d8;margin:0 0 8px"><strong>${stepsLabel}</strong></p>
    <ol style="color:#d4d4d8;font-size:14px;padding-left:20px;margin:0 0 24px;line-height:1.8">
      ${steps.map((s) => `<li>${s}</li>`).join('')}
    </ol>

    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:8px;padding:16px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-size:13px;color:#a1a1aa"><strong>${copyLabel}</strong></p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#e4e4e7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${copyTemplate}</p>
    </div>

    <p style="font-size:14px;color:#d4d4d8;margin:0 0 8px"><strong>${nicheLabel}</strong></p>
    <ul style="color:#d4d4d8;font-size:13px;padding-left:20px;margin:0 0 24px;line-height:1.8">
      ${niches.map((s) => `<li>${s}</li>`).join('')}
    </ul>

    ${ctaButton(ctaLabel, dashboardUrl, 'linear-gradient(135deg,#7c3aed,#06b6d4)')}

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:13px;margin:0">${helpText}</p>`;

  const html = htmlWrapper(content, 'rgba(124,58,237,0.12)');
  return { html, text: htmlToText(html), subject };
}
