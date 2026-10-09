/**
 * Theme & Color Sanitizer for Partner White-Label Configuration.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/theme-sanitizer
 */

import type {
  PartnerWhitelabelConfig,
  WhitelabelCssTheme,
} from '@/tree/partners/types';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates a hex color string (#RRGGBB). If invalid, returns the fallback color.
 */
export function validateHexColor(color: string | null | undefined, fallback: string): string {
  if (!color || typeof color !== 'string') {
    return fallback;
  }
  const trimmed = color.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

/**
 * Sanitizes a URL for safe embedding inside CSS url("...").
 * Prevents CSS injection, url() breakouts, quotes, parens, and javascript: protocols.
 */
export function sanitizeUrlForCss(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }
  const trimmed = rawUrl.trim();
  // Reject any string containing quotes, parentheses, backslashes, angle brackets, semicolons, or control whitespace
  if (/["'()\\<>;\s\r\n]/.test(trimmed)) {
    return '';
  }
  // Reject javascript:, vbscript:, data: URIs
  if (/^(javascript|vbscript):/i.test(trimmed)) {
    return '';
  }
  // Must start with https://, http://, or /
  if (!/^(https?:\/\/|\/)[^"'()\\<>;\s]+$/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

/**
 * Resolves CSS theme custom properties from white-label config.
 * Sanitizes logo/favicon URLs and validates hex color codes to prevent CSS injection.
 */
export function resolveWhitelabelTheme(
  config: Partial<PartnerWhitelabelConfig> | null,
): WhitelabelCssTheme {
  const primary = validateHexColor(config?.primary_color, '#06b6d4');
  const accent = validateHexColor(config?.accent_color, '#3b82f6');
  const logoUrl = sanitizeUrlForCss(config?.logo_url);
  const faviconUrl = sanitizeUrlForCss(config?.favicon_url);
  const brandName = config?.brand_name?.trim() || 'Sophia AI Factory';
  const supportUrl = sanitizeUrlForCss(config?.support_url);

  return {
    brandPrimary: primary,
    brandAccent: accent,
    brandLogoUrl: logoUrl,
    brandFaviconUrl: faviconUrl,
    brandAgencyName: brandName,
    brandSupportUrl: supportUrl,
    customCssProperties: {
      '--brand-primary': primary,
      '--brand-accent': accent,
      '--brand-logo-url': logoUrl ? `url("${logoUrl}")` : 'none',
      '--brand-favicon-url': faviconUrl,
      '--brand-agency-name': brandName,
      '--brand-support-url': supportUrl,
    },
  };
}
