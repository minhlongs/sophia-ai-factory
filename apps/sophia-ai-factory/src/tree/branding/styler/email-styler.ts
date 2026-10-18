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
} from './types';
import {
  isValidHttpUrl,
  getContrastTextColor,
  applyBrandStyling,
} from './css-inliner';
import { renderEmailHeader, renderEmailFooter } from './mjml-builder';
import { renderEmailDocumentShell } from './email-document-template';

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
  return renderEmailDocumentShell({
    agencyName: branding?.agencyName ?? '',
    locale,
    width,
    primaryColor,
    contrastText,
    preheaderText: options.preheaderText,
    headerHtml,
    styledBody,
    footerHtml,
  });
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
