/**
 * Dunning Day-5 email — "Your account will be suspended"
 *
 * Sent 120h after the first payment decline (final warning before suspension).
 * Communicates what features will be lost and provides a one-click retry link.
 *
 * @module forest/email/templates/dunning-day5-final-warning
 */

import { htmlWrapper, htmlToText, BASE_URL } from './shared-layout';
import { buildEnContent, buildViContent } from './dunning-day5-content';

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
