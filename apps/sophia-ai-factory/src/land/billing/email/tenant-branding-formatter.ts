/**
 * Tenant Email Branding HTML Formatting Helpers
 *
 * Layer: land (business orchestration)
 * Allowed imports: @/seed/*, @/tree/*
 *
 * @module billing/email/tenant-branding-formatter
 */

import {
  formatWhiteLabelEmail,
  escapeHtml,
} from '@/tree/branding/email-styler';
import type { WhiteLabelEmailBranding } from '@/tree/branding/email-styler';
import type { ResolvedEmailBranding } from './tenant-branding-resolver';

/**
 * Converts ResolvedEmailBranding to WhiteLabelEmailBranding for email-styler.
 */
export function toWhiteLabelBranding(branding: ResolvedEmailBranding): WhiteLabelEmailBranding {
  return {
    agencyName: branding.agencyName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    customDomain: branding.customDomain,
    supportEmail: branding.supportEmail,
    legalDisclaimer: branding.legalDisclaimer,
    unsubscribeUrl: branding.unsubscribeUrl,
    emailFooter: branding.footerMarkdown,
    emailFromName: branding.fromName,
    poweredBySophia: !branding.isWhiteLabel,
  };
}

/**
 * Format email with white-label layout using resolved tenant branding.
 */
export function formatTenantEmail(html: string, branding: ResolvedEmailBranding): string {
  return formatWhiteLabelEmail(html, toWhiteLabelBranding(branding));
}

/**
 * Append tenant email footer to an HTML body.
 * Escapes the footer markdown as plain text inside a styled block.
 * No-op if footerMarkdown is null.
 */
export function appendEmailFooter(html: string, footerMarkdown: string | null): string {
  if (!footerMarkdown) return html;
  const escaped = escapeHtml(footerMarkdown);
  const footerHtml = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #374151;font-size:12px;color:#6b7280;white-space:pre-wrap;">${escaped}</div>`;
  return html.includes('</body>')
    ? html.replace('</body>', () => `${footerHtml}</body>`)
    : html + footerHtml;
}

/**
 * Build logo img tag for email header. No-op if logoUrl is null.
 */
export function buildLogoImgTag(logoUrl: string | null): string {
  if (!logoUrl) return '';
  return `<img src="${escapeHtml(logoUrl)}" alt="logo" style="max-height:40px;max-width:160px;display:block;margin-bottom:16px;" />`;
}
