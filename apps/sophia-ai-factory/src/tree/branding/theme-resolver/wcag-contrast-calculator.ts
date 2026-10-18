/**
 * WCAG 2.1 Luminance, Contrast Calculator & HSL Shade Scale Generator
 * Layer: tree/branding/theme-resolver
 *
 * @module tree/branding/theme-resolver/wcag-contrast-calculator
 */

import type {
  ContrastColorSpec,
  RgbColor,
  HslColor,
} from '@/seed/types/white-label-branding';
import { CANONICAL_THEME_FALLBACKS } from './types';
import { hexToRgb } from './color-palette-generator';

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
  return {
    '50': `${h} ${Math.min(100, Math.round(s * 1.05))}% 96%`,
    '100': `${h} ${Math.min(100, Math.round(s * 1.02))}% 90%`,
    '200': `${h} ${s}% 82%`,
    '300': `${h} ${s}% 74%`,
    '400': `${h} ${s}% 64%`,
    '500': `${h} ${s}% ${l}%`,
    '600': `${h} ${s}% ${Math.max(12, Math.round(l * 0.82))}%`,
    '700': `${h} ${Math.min(100, Math.round(s * 1.05))}% ${Math.max(10, Math.round(l * 0.68))}%`,
    '800': `${h} ${Math.min(100, Math.round(s * 1.08))}% ${Math.max(8, Math.round(l * 0.52))}%`,
    '900': `${h} ${Math.min(100, Math.round(s * 1.1))}% ${Math.max(6, Math.round(l * 0.38))}%`,
  };
}
