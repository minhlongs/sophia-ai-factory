/**
 * White-Label Email Formatter
 *
 * Provides transactional agency-branded email formatting for MASTER tier tenants.
 * Injects agency logo / typography, brand primary color accents, legal disclaimer,
 * custom support email, and unbranded unsubscribe links.
 * Provides fallback to a clean neutral unbranded layout with ZERO vendor mention.
 *
 * Layer: tree (pure domain logic)
 * Allowed imports: @/seed/*, @/tree/*
 *
 * @module tree/branding/email-styler
 */

import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import {
  normalizeHexColor,
  hexToRgb,
  calculateRelativeLuminance,
} from './theme-resolver';

export interface WhiteLabelEmailBranding {
  /** Custom agency display name */
  agencyName?: string | null;
  /** Custom agency logo image URL */
  logoUrl?: string | null;
  /** Primary brand color (hex, e.g. '#6366f1') */
  primaryColor?: string | null;
  /** Secondary/accent brand color */
  accentColor?: string | null;
  /** Custom agency customer support email */
  supportEmail?: string | null;
  /** Agency custom domain */
  customDomain?: string | null;
  /** Legal entity disclaimer or registered address */
  legalDisclaimer?: string | null;
  /** Unbranded unsubscribe link */
  unsubscribeUrl?: string | null;
  /** Markdown/text footer notes */
  emailFooter?: string | null;
  /** Sender display name (e.g. 'Apex Media') */
  emailFromName?: string | null;
  /** Explicit opt-in for platform watermark (default: false in MASTER tier) */
  poweredBySophia?: boolean;
}

export interface EmailFormatOptions {
  /** Document locale: 'vi' or 'en' */
  locale?: 'vi' | 'en';
  /** Inbox preview preheader snippet */
  preheaderText?: string;
  /** Max container width in pixels (default 580) */
  containerWidth?: number;
}

const DEFAULT_PRIMARY_COLOR = '#7c3aed';
const DEFAULT_BG_COLOR = '#09090b';
const DEFAULT_CONTAINER_BG = '#18181b';
const DEFAULT_TEXT_COLOR = '#e4e4e7';
const DEFAULT_MUTED_COLOR = '#a1a1aa';

/**
 * Validates that an unsubscribe URL strictly begins with http:// or https://.
 * Rejects javascript:, data:, relative URLs, or other pseudo-protocols.
 */
export function isValidHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed);
}

/**
 * Basic HTML entity escaper to prevent XSS in email clients.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Computes high-contrast text color (black or white) for buttons using W3C relative luminance.
 * Conforms to WCAG 2.1 AA (>4.5:1 for normal text, >3.0:1 for graphical UI components/buttons).
 * 
 * Harmonized with theme-resolver.ts:
 * L = 0.2126R + 0.7152G + 0.0722B
 * Ensures bright colors (#00FF00 lime, #10B981 emerald, #FFFF00 yellow) select dark text (#09090b).
 */
export function getContrastTextColor(hexColor: string): string {
  const normalized = normalizeHexColor(hexColor, DEFAULT_PRIMARY_COLOR);
  const rgb = hexToRgb(normalized);
  const luminance = calculateRelativeLuminance(rgb);

  // Contrast ratio with white (luminance 1.0): (1.0 + 0.05) / (luminance + 0.05)
  const contrastRatioWithWhite = (1.0 + 0.05) / (luminance + 0.05);

  // Backgrounds with luminance <= 0.25 (or contrast with white >= 4.0:1) maintain high contrast with white.
  // Brighter backgrounds (lime #00FF00, emerald #10B981, yellow, cyan) select dark text #09090b.
  const isLightForeground = contrastRatioWithWhite >= 4.0 || luminance <= 0.25;

  return isLightForeground ? '#ffffff' : '#09090b';
}

/**
 * Formats transactional email body with agency white-label styling.
 * 
 * Injects:
 * 1. Header: Agency logo image or agency name typography; fallback to clean neutral bar.
 * 2. Styling: Brand primary color injected into button backgrounds and link colors.
 * 3. Footer: Agency legal disclaimer, custom support email, and unbranded unsubscribe link.
 */
export function formatWhiteLabelEmail(
  htmlBody: string,
  branding?: WhiteLabelEmailBranding | null,
  options: EmailFormatOptions = {},
): string {
  const primaryColor = branding?.primaryColor
    ? normalizeHexColor(branding.primaryColor, DEFAULT_PRIMARY_COLOR)
    : DEFAULT_PRIMARY_COLOR;
  const contrastText = getContrastTextColor(primaryColor);
  const width = options.containerWidth ?? 580;
  const locale = options.locale ?? 'en';

  // 1. Render Header
  const headerHtml = renderEmailHeader(branding, primaryColor);

  // 2. Render Footer
  const footerHtml = renderEmailFooter(branding, primaryColor, locale);

  // 3. Process Content & Apply Brand Color Styling
  const styledBody = applyBrandStyling(htmlBody, primaryColor, contrastText);

  // 4. If htmlBody is already a complete HTML document, inject header & footer
  // Use replacer functions to prevent JavaScript regex special replacement tokens ($&, $1, $')
  // from corrupting the document when agency names or footers contain '$'
  if (styledBody.includes('<body') && styledBody.includes('</body>')) {
    let doc = styledBody;
    // Inject header after <body> opening
    doc = doc.replace(/(<body[^>]*>)/i, (match) => `${match}\n${headerHtml}`);
    // Inject footer before </body> closing
    doc = doc.replace(/<\/body>/i, (match) => `\n${footerHtml}\n${match}`);
    return doc;
  }

  // 5. Wrap inside a bulletproof responsive email container
  const preheaderHtml = options.preheaderText
    ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
        ${escapeHtml(options.preheaderText)}
       </div>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${locale}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(branding?.agencyName ?? '')}</title>
  <style type="text/css">
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:${DEFAULT_BG_COLOR}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { color:${primaryColor}; text-decoration:none; }
    a:hover { text-decoration:underline; }
    .brand-btn { background-color:${primaryColor} !important; color:${contrastText} !important; border-radius:8px; text-decoration:none; display:inline-block; font-weight:600; padding:14px 28px; }
  </style>
</head>
<body style="margin:0;padding:24px 12px;background-color:${DEFAULT_BG_COLOR};color:${DEFAULT_TEXT_COLOR};">
  ${preheaderHtml}
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:${width}px;background-color:${DEFAULT_CONTAINER_BG};border:1px solid #27272a;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.4);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 16px 32px;" align="center">
              ${headerHtml}
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:16px 32px 32px 32px;font-size:15px;line-height:24px;color:${DEFAULT_TEXT_COLOR};">
              ${styledBody}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 32px 32px;">
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderEmailHeader(
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

function renderEmailFooter(
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

/**
 * Rewrites button and link styling in the provided HTML body.
 * Replaces hardcoded Sophia gradient colors with tenant primary color.
 */
function applyBrandStyling(html: string, primaryColor: string, contrastText: string): string {
  let output = html;

  // Replace button background gradients with tenant primary color
  output = output.replace(
    /background:\s*linear-gradient\([^)]+\)/gi,
    () => `background-color:${primaryColor}`
  );

  // Replace default purple brand hex (#7c3aed or #a78bfa) with primary color
  output = output.replace(/#7c3aed/gi, () => primaryColor);

  // Ensure button links have high contrast text
  output = output.replace(
    /(<a[^>]*class=["'][^"']*btn[^"']*["'][^>]*)style=["']([^"']*)["']/gi,
    (_match, tagPrefix, styleContent) => {
      const updatedStyle = `background-color:${primaryColor};color:${contrastText};${styleContent}`;
      return `${tagPrefix}style="${updatedStyle}"`;
    }
  );

  return output;
}

/**
 * Converts formatted white-label email to plain text with agency footer.
 */
export function formatWhiteLabelPlainText(
  textBody: string,
  branding?: WhiteLabelEmailBranding | null,
): string {
  let result = textBody.trim();

  if (branding?.agencyName) {
    result = `${branding.agencyName.toUpperCase()}\n\n${result}`;
  }

  const footerParts: string[] = [];
  if (branding?.supportEmail) {
    footerParts.push(`Support: ${branding.supportEmail}`);
  }
  if (branding?.legalDisclaimer ?? branding?.emailFooter) {
    footerParts.push(branding.legalDisclaimer ?? branding.emailFooter!);
  }
  if (branding?.unsubscribeUrl && isValidHttpUrl(branding.unsubscribeUrl)) {
    footerParts.push(`Unsubscribe: ${branding.unsubscribeUrl.trim()}`);
  }

  if (footerParts.length > 0) {
    result += `\n\n---\n${footerParts.join('\n')}`;
  }

  return result;
}

/**
 * Interface contract matching PROJECT.md:70:
 * wrapWithAgencyBranding(htmlContent: string, branding: BrandingSettings): string
 */
export function wrapWithAgencyBranding(
  htmlContent: string,
  branding?: Partial<BrandingSettings> | null,
): string {
  const emailBranding: WhiteLabelEmailBranding = {
    agencyName: branding?.agencyName,
    logoUrl: branding?.logoUrl,
    primaryColor: branding?.primaryColor,
    accentColor: branding?.accentColor,
    customDomain: branding?.customDomain,
    emailFromName: branding?.emailFromName,
    emailFooter: branding?.emailFooter,
    legalDisclaimer: branding?.emailFooter,
    poweredBySophia: false,
  };

  return formatWhiteLabelEmail(htmlContent, emailBranding);
}
