/**
 * Color Palette Generator & WCAG Contrast Calculator
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/branding/theme-resolver/color-palette-generator
 */

import type {
  RgbColor,
  HslColor,
} from '@/seed/types/white-label-branding';
import { CANONICAL_THEME_FALLBACKS } from './types';

export {
  calculateRelativeLuminance,
  computeContrastColor,
  formatHslChannels,
  generateShadeScale,
} from './wcag-contrast-calculator';

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
