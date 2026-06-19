/**
 * Affiliate Day-7 case-study email — social proof + personalized week-1 stats.
 * Sent ~7 days after enrollment to keep affiliates engaged with concrete benchmarks
 * and (when available) their own first-week performance.
 *
 * @module lib/email/templates/affiliate-day7-case-study
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface AffiliateDay7Stats {
  /** Clicks on the user's referral link in week 1. */
  totalClicks: number;
  /** Paid conversions attributed to the referral code. */
  totalConversions: number;
  /** Pending commission earned in USD (gross, pre-payout). */
  pendingEarningsUsd: number;
}

export interface AffiliateDay7Data {
  ownerFullName: string;
  locale: string;
  /** Optional — when omitted, email skips the "your week 1" block and shows benchmark only. */
  stats?: AffiliateDay7Stats;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function renderAffiliateDay7CaseStudy(data: AffiliateDay7Data): RenderedEmail {
  const isVi = data.locale.startsWith('vi');
  const localePath = isVi ? 'vi' : 'en';
  const dashboardUrl = `${BASE_URL}/${localePath}/dashboard/affiliate`;

  const subject = isVi
    ? 'Tuần đầu của bạn + cách top affiliate đạt $500/tháng'
    : 'Your week 1 + how top affiliates hit $500/month';

  const greeting = isVi ? `Xin chào ${data.ownerFullName},` : `Hello ${data.ownerFullName},`;

  const intro = isVi
    ? `Tuần đầu chương trình affiliate đã trôi qua. Đây là một case study + benchmark thực tế để bạn so sánh.`
    : `Your first affiliate week is in the books. Here is a real case study + benchmark for context.`;

  const caseStudyTitle = isVi ? 'Case study — "Mai T."' : 'Case study — "Mai T."';
  const caseStudyBody = isVi
    ? `Mai (TikTok creator, 12K followers) join chương trình tuần 1 của tháng 3. Cô post 1 tweet ghim + 1 video TikTok ngắn giải thích Sophia.<br><br><strong>Tuần 1 results:</strong> 184 clicks → 7 conversions → $87 hoa hồng (định kỳ).<br><br><strong>Tháng 3 (đầy đủ):</strong> $512 MRR sau 4 tuần.<br><br><em>Bí kíp của Mai:</em> "Tôi không bán cứng. Tôi quay video chỉ ra mình tiết kiệm 8h/tuần như thế nào, link ở bio."`
    : `Mai (TikTok creator, 12K followers) joined in week 1 of March. She posted one pinned tweet + one short TikTok explaining how Sophia works.<br><br><strong>Week 1 results:</strong> 184 clicks → 7 conversions → $87 in recurring commission.<br><br><strong>Full March:</strong> $512 MRR after 4 weeks.<br><br><em>Mai's tip:</em> "I don't hard-sell. I show how it saves me 8h/week, link in bio."`;

  let yourWeekBlock = '';
  if (data.stats) {
    const { totalClicks, totalConversions, pendingEarningsUsd } = data.stats;
    const yourTitle = isVi ? 'Tuần 1 của bạn' : 'Your week 1';
    const labels = isVi
      ? { clicks: 'Clicks', conversions: 'Conversions', earnings: 'Pending earnings' }
      : { clicks: 'Clicks', conversions: 'Conversions', earnings: 'Pending earnings' };
    yourWeekBlock = `
      <div style="background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);border-radius:8px;padding:16px;margin:0 0 24px">
        <p style="margin:0 0 12px;font-size:14px;color:#06b6d4"><strong>${yourTitle}</strong></p>
        <table style="width:100%;border-collapse:collapse;color:#e4e4e7;font-size:14px">
          <tr><td style="padding:4px 0">${labels.clicks}</td><td style="padding:4px 0;text-align:right;font-weight:600">${totalClicks}</td></tr>
          <tr><td style="padding:4px 0">${labels.conversions}</td><td style="padding:4px 0;text-align:right;font-weight:600">${totalConversions}</td></tr>
          <tr><td style="padding:4px 0">${labels.earnings}</td><td style="padding:4px 0;text-align:right;font-weight:600">$${fmtUsd(pendingEarningsUsd)}</td></tr>
        </table>
      </div>`;
  }

  const benchmarkTitle = isVi ? 'Benchmark tuần 1 (median):' : 'Week 1 benchmark (median):';
  const benchmarkRows = isVi
    ? ['~120 clicks', '~5 conversions', '~$60 pending earnings']
    : ['~120 clicks', '~5 conversions', '~$60 pending earnings'];

  const ctaLabel = isVi ? 'Xem analytics đầy đủ' : 'See full analytics';

  const helpText = isVi
    ? 'Cần ý tưởng content tuần 2? Reply email này — tôi gửi 5 hook đã verify convert.'
    : 'Need week-2 content ideas? Reply — I will share 5 hooks that have been verified to convert.';

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6">${intro}</p>

    ${yourWeekBlock}

    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:8px;padding:16px;margin:0 0 24px">
      <p style="margin:0 0 12px;font-size:14px;color:#a78bfa"><strong>${caseStudyTitle}</strong></p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#d4d4d8">${caseStudyBody}</p>
    </div>

    <p style="font-size:14px;color:#d4d4d8;margin:0 0 8px"><strong>${benchmarkTitle}</strong></p>
    <ul style="color:#d4d4d8;font-size:13px;padding-left:20px;margin:0 0 24px;line-height:1.8">
      ${benchmarkRows.map((s) => `<li>${s}</li>`).join('')}
    </ul>

    ${ctaButton(ctaLabel, dashboardUrl, 'linear-gradient(135deg,#7c3aed,#06b6d4)')}

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
    <p style="color:#71717a;font-size:13px;margin:0">${helpText}</p>`;

  const html = htmlWrapper(content, 'rgba(124,58,237,0.12)');
  return { html, text: htmlToText(html), subject };
}
