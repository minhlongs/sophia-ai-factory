/**
 * Dunning Day-3 email — "Action required: update your payment"
 *
 * Sent 72h after the first payment decline. Urgent tone: countdown to
 * suspension, retry deep-link to /dashboard/billing?retry=true.
 *
 * @module forest/email/templates/dunning-day3-action-required
 */

import { htmlWrapper, htmlToText, BASE_URL } from './shared-layout';
import { buildEnContent, buildViContent } from './dunning-day3-content-builders';

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
