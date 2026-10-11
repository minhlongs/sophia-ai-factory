/**
 * CSS Variable Mapping Engine
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/branding/theme-resolver/css-variable-mapper
 */

import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import type { ThemeCssVariables } from '@/seed/types/white-label-branding';
import { CANONICAL_THEME_FALLBACKS } from './types';
import {
  normalizeHexColor,
  hexToRgb,
  rgbToHsl,
  computeContrastColor,
  formatHslChannels,
  generateShadeScale,
} from './color-palette-generator';

export function sanitizeCssVarValue(val: string): string {
  return val
    .replace(/[\r\n]/g, ' ')
    .replace(/<\/style/gi, '')
    .replace(/[<>";{}\\]/g, '');
}

/**
 * Resolves complete CSS variable mappings from tenant BrandingSettings.
 */
export function resolveThemeCssVariables(
  branding?: Partial<BrandingSettings> | null,
): ThemeCssVariables {
  const primaryHex = normalizeHexColor(branding?.primaryColor, CANONICAL_THEME_FALLBACKS.primaryColor);
  const accentHex = normalizeHexColor(branding?.accentColor, CANONICAL_THEME_FALLBACKS.accentColor);

  const primaryRgb = hexToRgb(primaryHex);
  const primaryHsl = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  const primaryContrast = computeContrastColor(primaryHex);

  const accentRgb = hexToRgb(accentHex);
  const accentHsl = rgbToHsl(accentRgb.r, accentRgb.g, accentRgb.b);
  const accentContrast = computeContrastColor(accentHex);

  const primaryShades = generateShadeScale(primaryHsl);
  const accentShades = generateShadeScale(accentHsl);

  const primaryHslStr = formatHslChannels(primaryHsl);
  const accentHslStr = formatHslChannels(accentHsl);

  const vars: ThemeCssVariables = {
    // Tailwind v4 Bridge Tokens
    '--primary': primaryHslStr,
    '--primary-foreground': primaryContrast.hsl,
    '--primary-container': `${primaryHsl.h} ${Math.min(100, Math.round(primaryHsl.s * 0.75))}% 22%`,
    '--on-primary-container': `${primaryHsl.h} 100% 92%`,
    '--ring': primaryHslStr,
    '--accent': accentHslStr,
    '--accent-foreground': accentContrast.hsl,

    // Primary Shades
    '--primary-50': primaryShades['50'],
    '--primary-100': primaryShades['100'],
    '--primary-200': primaryShades['200'],
    '--primary-300': primaryShades['300'],
    '--primary-400': primaryShades['400'],
    '--primary-500': primaryShades['500'],
    '--primary-600': primaryShades['600'],
    '--primary-700': primaryShades['700'],
    '--primary-800': primaryShades['800'],
    '--primary-900': primaryShades['900'],

    // Accent Shades
    '--accent-50': accentShades['50'],
    '--accent-100': accentShades['100'],
    '--accent-200': accentShades['200'],
    '--accent-300': accentShades['300'],
    '--accent-400': accentShades['400'],
    '--accent-500': accentShades['500'],
    '--accent-600': accentShades['600'],
    '--accent-700': accentShades['700'],
    '--accent-800': accentShades['800'],
    '--accent-900': accentShades['900'],

    // White-Label Specific Tokens
    '--brand-primary': primaryHex,
    '--brand-primary-rgb': `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`,
    '--brand-primary-hsl': primaryHslStr,
    '--brand-primary-contrast': primaryContrast.hex,
    '--brand-primary-contrast-hsl': primaryContrast.hsl,
    '--brand-accent': accentHex,
    '--brand-accent-rgb': `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    '--brand-accent-hsl': accentHslStr,
    '--brand-accent-contrast': accentContrast.hex,
  };

  if (branding?.agencyName) {
    // Sanitize string to prevent CSS escape breakout and SSR HTML style tag breakout
    vars['--brand-agency-name'] = `"${sanitizeCssVarValue(branding.agencyName)}"`;
  }
  if (branding?.logoUrl) {
    vars['--brand-logo-url'] = `url("${sanitizeCssVarValue(branding.logoUrl)}")`;
  }
  if (branding?.faviconUrl) {
    vars['--brand-favicon-url'] = `url("${sanitizeCssVarValue(branding.faviconUrl)}")`;
  }

  return vars;
}
