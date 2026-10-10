/**
 * White-Label Email Styler Service
 *
 * Formats transactional email body with agency white-label styling.
 * Injects:
 * 1. Header: Agency logo image or agency name typography; fallback to clean neutral bar.
 * 2. Styling: Brand primary color injected into button backgrounds and link colors.
 * 3. Footer: Agency legal disclaimer, custom support email, and unbranded unsubscribe link.
 *
 * Layer: tree/branding/styler
 * Allowed imports: @/seed/*, @/tree/branding/*
 */

import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { normalizeHexColor } from '../theme-resolver';
import {
  type WhiteLabelEmailBranding,
  type EmailFormatOptions,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_BG_COLOR,
  DEFAULT_CONTAINER_BG,
  DEFAULT_TEXT_COLOR,
} from './types';
import {
  escapeHtml,
  isValidHttpUrl,
  getContrastTextColor,
  applyBrandStyling,
} from './css-inliner';
import { renderEmailHeader, renderEmailFooter } from './mjml-builder';

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
  if (styledBody.includes('<body') && styledBody.includes('</body>')) {
    let doc = styledBody;
    doc = doc.replace(/(<body[^>]*>)/i, (match) => `${match}\n${headerHtml}`);
    doc = doc.replace(/<\/body>/i, (match) => `\n${footerHtml}\n${match}`);
    return doc;
  }

  // 5. Wrap inside a responsive email container
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
 * Interface contract matching PROJECT.md:
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
