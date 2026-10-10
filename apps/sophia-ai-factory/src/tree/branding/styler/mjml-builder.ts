/**
 * Email header and footer layout wrapper renderer.
 *
 * Layer: tree/branding/styler
 * Allowed imports: @/seed/*
 */

import {
  type WhiteLabelEmailBranding,
  DEFAULT_MUTED_COLOR,
} from './types';
import { escapeHtml, isValidHttpUrl } from './css-inliner';

export function renderEmailHeader(
  branding: WhiteLabelEmailBranding | null | undefined,
  primaryColor: string,
): string {
  // Case 1: Logo image present
  if (branding?.logoUrl) {
    const altText = escapeHtml(branding.agencyName ?? 'Company Logo');
    return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom:12px;">
          <img src="${escapeHtml(branding.logoUrl)}" alt="${altText}" style="max-height:48px;max-width:220px;display:block;margin:0 auto;object-fit:contain;" />
        </td>
      </tr>
    </table>`;
  }

  // Case 2: Agency name present
  if (branding?.agencyName) {
    return `<h1 style="font-size:22px;font-weight:700;margin:0 0 8px 0;color:${primaryColor};text-align:center;letter-spacing:-0.3px;">
      ${escapeHtml(branding.agencyName)}
    </h1>`;
  }

  // Case 3: Clean unbranded fallback layout (no Sophia branding, minimalist accent bar)
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding-bottom:8px;">
        <div style="height:3px;width:40px;background-color:${primaryColor};border-radius:2px;margin:0 auto;"></div>
      </td>
    </tr>
  </table>`;
}

export function renderEmailFooter(
  branding: WhiteLabelEmailBranding | null | undefined,
  primaryColor: string,
  locale: 'vi' | 'en',
): string {
  const disclaimer = branding?.legalDisclaimer ?? branding?.emailFooter;
  const supportEmail = branding?.supportEmail;
  const unsubscribeUrl = branding?.unsubscribeUrl;

  const supportLabel = locale === 'vi' ? 'Hỗ trợ' : 'Support';
  const unsubscribeLabel = locale === 'vi' ? 'Hủy đăng ký nhận tin' : 'Unsubscribe';

  const rows: string[] = [];

  // Divider
  rows.push(`<hr style="border:none;border-top:1px solid #27272a;margin:24px 0 20px 0;" />`);

  // Support link
  if (supportEmail) {
    rows.push(
      `<p style="font-size:12px;color:${DEFAULT_MUTED_COLOR};margin:0 0 8px 0;text-align:center;">
        ${supportLabel}: <a href="mailto:${escapeHtml(supportEmail)}" style="color:${primaryColor};text-decoration:none;font-weight:500;">${escapeHtml(supportEmail)}</a>
      </p>`
    );
  }

  // Legal disclaimer
  if (disclaimer) {
    rows.push(
      `<p style="font-size:11px;line-height:16px;color:#71717a;margin:8px 0;text-align:center;white-space:pre-wrap;">
        ${escapeHtml(disclaimer)}
      </p>`
    );
  }

  // Unbranded unsubscribe link (strictly validated http:// or https://)
  if (unsubscribeUrl && isValidHttpUrl(unsubscribeUrl)) {
    rows.push(
      `<p style="font-size:11px;color:#71717a;margin:12px 0 0 0;text-align:center;">
        <a href="${escapeHtml(unsubscribeUrl.trim())}" style="color:#71717a;text-decoration:underline;">${unsubscribeLabel}</a>
      </p>`
    );
  }

  // Optional platform credit (omitted in pure white-label mode)
  if (branding?.poweredBySophia === true) {
    rows.push(
      `<p style="font-size:10px;color:#52525b;margin:16px 0 0 0;text-align:center;">
        Powered by Sophia AI Factory
      </p>`
    );
  }

  return rows.join('\n');
}
