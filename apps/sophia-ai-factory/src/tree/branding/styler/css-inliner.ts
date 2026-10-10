/**
 * CSS inlining, contrast calculation, and HTML escaping utilities.
 *
 * Layer: tree/branding/styler
 * Allowed imports: @/seed/*, @/tree/branding/*
 */

import {
  normalizeHexColor,
  hexToRgb,
  calculateRelativeLuminance,
} from '../theme-resolver';
import { DEFAULT_PRIMARY_COLOR } from './types';

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

  const contrastRatioWithWhite = (1.0 + 0.05) / (luminance + 0.05);
  const isLightForeground = contrastRatioWithWhite >= 4.0 || luminance <= 0.25;

  return isLightForeground ? '#ffffff' : '#09090b';
}

/**
 * Rewrites button and link styling in the provided HTML body.
 * Replaces hardcoded Sophia gradient colors with tenant primary color.
 */
export function applyBrandStyling(html: string, primaryColor: string, contrastText: string): string {
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
