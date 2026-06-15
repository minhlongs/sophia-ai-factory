/**
 * D+14 re-engagement email — sent to users who signed up 14d ago, have an
 * active subscription, but have been inactive for 7+ days.
 *
 * Distinct from `win-back` (D+60, targets CANCELLED users). This targets
 * still-paying users who are at risk of churning.
 *
 * @module lib/email/templates/re-engagement-d14
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface ReEngagementD14Data {
  ownerFullName: string;
  locale: string;
  /** Days since last meaningful activity (login or video). */
  daysSinceLastActivity: number;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderReEngagementD14(data: ReEngagementD14Data): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;
  const dashUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard`;
  const telegramUrl = 'https://t.me/Sophia_Bbot';
  const cancelUrl = `${BASE_URL}/${isVi ? 'vi' : 'en'}/dashboard/billing/cancel`;
  const days = Math.max(1, Math.floor(data.daysSinceLastActivity));

  const subject = isVi
    ? `Sophia chưa thấy bạn ${days} ngày`
    : `Sophia hasn't seen you in ${days} days`;

  const greeting = isVi ? `Chào ${name},` : `Hi ${name},`;
  const intro = isVi
    ? `Bạn signup 2 tuần trước, nhưng ${days} ngày qua không hoạt động. Sophia muốn check-in — không spam, chỉ hỏi thẳng:`
    : `You signed up 2 weeks ago, but the last ${days} days were quiet. A direct check-in — no spam, just honest:`;

  const questions = isVi
    ? [
        '1. Setup Wizard có chỗ nào bị kẹt? (BYOK keys hay được dán đúng nhưng provider không response)',
        '2. Video đầu tiên không đạt chất lượng mong đợi? (script, voice, hay visual?)',
        '3. Bạn không tìm thấy thời gian? (lên lịch bulk = giải quyết được)',
        '4. Sophia không phù hợp với business của bạn? (reply để Sophia hiểu — refund nếu fair)',
      ]
    : [
        "1. Did the Setup Wizard get stuck? (BYOK keys pasted but provider not responding?)",
        "2. First video didn't match your quality bar? (script, voice, or visual?)",
        "3. Out of time? (bulk scheduling solves this — schedule once, run all week)",
        "4. Sophia doesn't fit your business? (reply — Sophia wants to understand; refund if fair)",
    ];

  const ctaLabel = isVi ? 'Quay lại Dashboard' : 'Back to Dashboard';
  const replyNote = isVi
    ? `Reply email này (Sophia đọc tất cả) hoặc /help cho @Sophia_Bbot.`
    : `Reply to this email (Sophia reads every one) or send /help to @Sophia_Bbot.`;
  const cancelNote = isVi
    ? `Muốn hủy thay vì cố? Không trách: <a href="${cancelUrl}" style="color:#a1a1aa">hủy ở đây</a>. Sophia chỉ muốn customer phù hợp ở lại.`
    : `Want to cancel instead of pushing? No hard feelings: <a href="${cancelUrl}" style="color:#a1a1aa">cancel here</a>. Sophia only wants the right-fit customers to stay.`;

  const questionList = questions
    .map(
      (q) => `<li style="margin:0 0 10px;line-height:1.6">${q}</li>`,
    )
    .join('');

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 16px;line-height:1.6;color:#d4d4d8">${intro}</p>
    <ul style="color:#d4d4d8;font-size:14px;padding-left:0;list-style:none;margin:0 0 20px">
      ${questionList}
    </ul>
    ${ctaButton(ctaLabel, dashUrl, 'linear-gradient(135deg,#06b6d4,#7c3aed)')}
    <p style="margin:12px 0 0;text-align:center"><a href="${telegramUrl}" style="color:#a1a1aa;font-size:13px">${isVi ? 'Hoặc /help cho @Sophia_Bbot →' : 'Or /help on @Sophia_Bbot →'}</a></p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#a1a1aa;font-size:13px;margin:0 0 12px">${replyNote}</p>
    <p style="color:#71717a;font-size:12px;margin:0;line-height:1.6">${cancelNote}</p>`;

  const html = htmlWrapper(content, 'rgba(6,182,212,0.08)', 'rgba(124,58,237,0.08)');
  return { html, text: htmlToText(html), subject };
}
