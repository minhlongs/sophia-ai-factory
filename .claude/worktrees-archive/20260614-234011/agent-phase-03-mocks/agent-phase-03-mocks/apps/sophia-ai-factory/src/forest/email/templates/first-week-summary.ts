/**
 * D+7 first-week summary email — milestone-gated, data-rich.
 * Only sent if user has logged in and made at least 1 API call.
 * @module lib/email/templates/first-week-summary
 */

import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface WeekStats {
  totalCalls: number;
  topSop: string | null;
  daysActive: number;
}

export interface FirstWeekSummaryData {
  ownerFullName: string;
  stats: WeekStats;
  locale: string;
}

export function renderFirstWeekSummary(data: FirstWeekSummaryData): { html: string; text: string; subject: string } {
  const isVi = data.locale.startsWith('vi');
  const { stats } = data;
  const name = data.ownerFullName;

  const subject = isVi
    ? `Tuần đầu tiên của bạn với Sophia AI 🎉`
    : `Your first week with Sophia AI 🎉`;

  const greeting = isVi ? `Xin chào ${name},` : `Hello ${name},`;
  const intro = isVi
    ? `Đây là tóm tắt hoạt động của bạn trong tuần đầu tiên:`
    : `Here's a summary of your first week's activity:`;

  const callsLabel = isVi ? 'API calls' : 'API calls';
  const daysLabel = isVi ? 'ngày hoạt động' : 'active days';
  const topSopLabel = isVi ? 'SOP phổ biến nhất' : 'Top SOP';
  const dashboardLabel = isVi ? 'Mở Dashboard' : 'Open Dashboard';
  const upgradeLabel = isVi ? 'Nâng cấp để không giới hạn' : 'Upgrade for unlimited access';
  const ctaUrl = `${BASE_URL}/dashboard`;

  const topSopRow = stats.topSop
    ? `<tr><td style="padding:8px 0;color:#a1a1aa">${topSopLabel}:</td><td style="padding:8px 0;font-weight:600">${stats.topSop}</td></tr>`
    : '';

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6">${intro}</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
      <tr><td style="padding:8px 0;color:#a1a1aa">${callsLabel}:</td><td style="padding:8px 0;font-weight:600;font-size:20px">${stats.totalCalls}</td></tr>
      <tr><td style="padding:8px 0;color:#a1a1aa">${daysLabel}:</td><td style="padding:8px 0;font-weight:600">${stats.daysActive}</td></tr>
      ${topSopRow}
    </table>
    ${ctaButton(dashboardLabel, ctaUrl)}
    <br>
    <a href="${BASE_URL}/pricing" style="color:#a78bfa;font-size:13px">${upgradeLabel} →</a>`;

  const html = htmlWrapper(
    content,
    'rgba(245,158,11,0.12)',
    'rgba(139,92,246,0.12)',
    'rgba(245,158,11,0.3)',
  );
  return { html, text: htmlToText(html), subject };
}
