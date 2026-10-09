/**
 * White-Label Theme Resolution & CSS Variable Generation.
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/theme-resolver
 */

import type { PartnerWhitelabelConfig } from '@/tree/partners/types';
import type { UnbrandedAgencyPortalConfig, WhitelabelThemeInput } from './types';
import { validateHexColor, sanitizeUrlForCss } from './color-validator';
import { sanitizeBrandCss } from './css-sanitizer';

/**
 * Generates dynamic CSS variables for white-label theme injection.
 * Variables generated:
 * - `--brand-primary`
 * - `--brand-secondary`
 * - `--brand-accent`
 * - `--brand-logo-url`
 * - `--brand-favicon`
 * - `--brand-favicon-url`
 * - `--brand-agency-name`
 * - `--brand-support-url`
 * - `--brand-portal-title`
 * - `--primary`
 * - `--primary-foreground`
 * - `--ring`
 */
export function resolveWhitelabelTheme(
  config?:
    | WhitelabelThemeInput
    | Partial<PartnerWhitelabelConfig>
    | Partial<UnbrandedAgencyPortalConfig>
    | null,
): Record<string, string> {
  const cfg = (config ?? null) as WhitelabelThemeInput | null;

  const primaryColor = validateHexColor(
    cfg?.primaryColor ?? cfg?.primary_color,
    '#06b6d4',
  );

  const secondaryColor = validateHexColor(
    cfg?.accentColor ??
      cfg?.accent_color ??
      cfg?.secondaryColor ??
      cfg?.secondary_color,
    '#3b82f6',
  );

  const rawLogo = cfg?.logoUrl ?? cfg?.logo_url;
  const logoUrl = sanitizeUrlForCss(rawLogo);

  const rawFavicon = cfg?.faviconUrl ?? cfg?.favicon_url;
  const faviconUrl = sanitizeUrlForCss(rawFavicon);

  const brandName =
    cfg?.brandName?.trim() ??
    cfg?.brand_name?.trim() ??
    cfg?.agencyName?.trim() ??
    cfg?.agency_name?.trim() ??
    'Agency Client Portal';

  const rawSupport = cfg?.supportUrl ?? cfg?.support_url;
  const supportUrl = sanitizeUrlForCss(rawSupport);

  const portalTitle =
    cfg?.portalTitle?.trim() ??
    cfg?.portal_title?.trim() ??
    brandName;

  return {
    '--brand-primary': primaryColor,
    '--brand-secondary': secondaryColor,
    '--brand-accent': secondaryColor,
    '--brand-logo-url': logoUrl ? `url("${logoUrl}")` : 'none',
    '--brand-favicon': faviconUrl ? `url("${faviconUrl}")` : 'none',
    '--brand-favicon-url': faviconUrl,
    '--brand-agency-name': `"${brandName.replace(/"/g, '')}"`,
    '--brand-support-url': supportUrl,
    '--brand-portal-title': `"${portalTitle.replace(/"/g, '')}"`,
    '--primary': primaryColor,
    '--primary-foreground': '#ffffff',
    '--ring': primaryColor,
  };
}

/**
 * Generates an unbranded `:root { ... }` CSS block from theme variables and custom CSS.
 */
export function generateThemeCssBlock(
  variables: Record<string, string>,
  customCss?: string | null,
): string {
  const varLines = Object.entries(variables)
    .map(([key, val]) => `  ${key}: ${val};`)
    .join('\n');

  const sanitizedCss = sanitizeBrandCss(customCss);

  return `:root {\n${varLines}\n}${sanitizedCss ? `\n\n/* Agency Custom Styles */\n${sanitizedCss}` : ''}`;
}
