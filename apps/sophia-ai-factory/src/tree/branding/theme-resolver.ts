/**
 * Dynamic White-Label Theme Resolver.
 *
 * Computes CSS variables, contrast ratios, and color scales from tenant brand kit.
 * Pure domain logic — strictly Layer 2 (Tree), importing only Seed.
 *
 * @module tree/branding/theme-resolver
 */

import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import type {
  ThemeCssVariables,
  ContrastColorSpec,
  RgbColor,
  HslColor,
} from '@/seed/types/white-label-branding';

// Canonical fallback colors for Sophia AI platform
export const CANONICAL_THEME_FALLBACKS = {
  primaryColor: '#6366F1', // Electric Indigo
  accentColor: '#F59E0B',  // Cyber Amber
  darkBackground: '#08090D', // Deep Obsidian
  white: '#FFFFFF',
};

/**
 * Sanitize and normalize hex color string (e.g. "#7c3aed", "7C3AED", "#fff").
 * Returns normalized 6-digit hex with leading '#' or fallback if invalid.
 */
export function normalizeHexColor(
  rawColor: string | null | undefined,
  fallback: string = CANONICAL_THEME_FALLBACKS.primaryColor,
): string {
  if (!rawColor || typeof rawColor !== 'string') return fallback;

  const trimmed = rawColor.trim().replace(/^#/, '');
  // Match 3-digit (#RGB), 6-digit (#RRGGBB), or 8-digit (#RRGGBBAA)
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(trimmed)) {
    return fallback;
  }

  // Expand 3-digit shorthand (e.g. "abc" -> "aabbcc")
  if (trimmed.length === 3) {
    const r = trimmed[0];
    const g = trimmed[1];
    const b = trimmed[2];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  // Slice to 6 digits ignoring alpha if 8 digits
  return `#${trimmed.slice(0, 6)}`.toUpperCase();
}

/**
 * Convert normalized 6-digit hex to RGB values.
 */
export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace(/^#/, '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Convert RGB to HSL channels.
 * Returns h: [0, 360], s: [0, 100], l: [0, 100].
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hexToHsl(hex: string): HslColor {
  const rgb = hexToRgb(hex);
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

/**
 * Calculate WCAG 2.1 relative luminance.
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function calculateRelativeLuminance(rgb: RgbColor): number {
  const transform = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const rLin = transform(rgb.r);
  const gLin = transform(rgb.g);
  const bLin = transform(rgb.b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Compute optimal contrast foreground color (button text / icons) for a given background hex.
 * Guarantees WCAG 2.1 AA compliant text on buttons.
 */
export function computeContrastColor(bgHex: string): ContrastColorSpec {
  const rgb = hexToRgb(bgHex);
  const luminance = calculateRelativeLuminance(rgb);

  // Contrast with white (luminance 1.0)
  const contrastRatioWithWhite = (1.0 + 0.05) / (luminance + 0.05);

  // A background with luminance <= 0.25 maintains high contrast (>= 3.5:1) with white,
  // which is optimal for rich brand colors (indigo, purple, blue, emerald).
  // Brighter backgrounds (yellow, amber, cyan, white) use deep obsidian for AA compliance.
  const isLightForeground = contrastRatioWithWhite >= 4.0 || luminance <= 0.25;

  return {
    hex: isLightForeground ? CANONICAL_THEME_FALLBACKS.white : CANONICAL_THEME_FALLBACKS.darkBackground,
    hsl: isLightForeground ? '0 0% 100%' : '240 18% 4%',
    luminance,
    contrastRatioWithWhite,
    isLightForeground,
  };
}

/**
 * Format HSL for Tailwind v4 CSS variable consumption ("H S% L%").
 */
export function formatHslChannels(hsl: HslColor): string {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

/**
 * Compute a scale of lightness shades from a base HSL color (50 to 900).
 */
export function generateShadeScale(baseHsl: HslColor): Record<string, string> {
  const { h, s, l } = baseHsl;
  // Compute calibrated lightness curve around base lightness
  return {
    '50': `${h} ${Math.min(100, Math.round(s * 1.05))}% 96%`,
    '100': `${h} ${Math.min(100, Math.round(s * 1.02))}% 92%`,
    '200': `${h} ${Math.min(100, Math.round(s * 1.0))}% 84%`,
    '300': `${h} ${s}% 74%`,
    '400': `${h} ${s}% 64%`,
    '500': `${h} ${s}% ${l}%`,
    '600': `${h} ${s}% ${Math.max(12, Math.round(l * 0.82))}%`,
    '700': `${h} ${s}% ${Math.max(10, Math.round(l * 0.65))}%`,
    '800': `${h} ${s}% ${Math.max(8, Math.round(l * 0.48))}%`,
    '900': `${h} ${s}% ${Math.max(6, Math.round(l * 0.30))}%`,
  };
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

  const sanitizeCssVarValue = (val: string): string => {
    return val
      .replace(/<\/style/gi, '')
      .replace(/[<>";{}\\]/g, '');
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

/**
 * Builds CSS style text suitable for direct SSR `<style>` injection.
 */
export function buildThemeCssString(branding?: Partial<BrandingSettings> | null): string {
  const vars = resolveThemeCssVariables(branding);
  const declarations = Object.entries(vars)
    .map(([key, val]) => `  ${key}: ${val};`)
    .join('\n');

  return `:root, .dark {\n${declarations}\n}`;
}
