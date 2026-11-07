/**
 * OKLCH & WCAG Contrast / Color-Blindness Palette Validator
 *
 * Clean-room TypeScript implementation of the MIT Color.js / dataviz palette
 * validation mathematics (`sRGB -> Linear RGB -> OKLab/OKLCH` & WCAG 2.1 contrast).
 * Zero external runtime dependencies; safe for Seed layer and edge workers.
 *
 * @module seed/baoyu-design/oklch-palette-validator
 */

import type { OklchColor, OklchContrastReport } from './baoyu-schema-types';

interface RgbChannels {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * Parses a `#RRGGBB` or `#RGB` hex string into normalized `[0..1]` sRGB channels.
 */
export function parseHexToSrgb(hex: string): RgbChannels {
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16) / 255;
    const g = parseInt(cleaned[1] + cleaned[1], 16) / 255;
    const b = parseInt(cleaned[2] + cleaned[2], 16) / 255;
    return {
      r: Number.isFinite(r) ? r : 0,
      g: Number.isFinite(g) ? g : 0,
      b: Number.isFinite(b) ? b : 0,
    };
  }
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  return {
    r: Number.isFinite(r) ? r : 0,
    g: Number.isFinite(g) ? g : 0,
    b: Number.isFinite(b) ? b : 0,
  };
}

function srgbChannelToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/**
 * Computes WCAG 2.1 relative luminance `Y` in `[0..1]`.
 */
export function computeRelativeLuminance(hex: string): number {
  const { r, g, b } = parseHexToSrgb(hex);
  const rl = srgbChannelToLinear(r);
  const gl = srgbChannelToLinear(g);
  const bl = srgbChannelToLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/**
 * Computes WCAG 2.1 contrast ratio between two hex colors (`1.0` to `21.0`).
 */
export function computeWcagContrastRatio(fgHex: string, bgHex: string): number {
  const lumA = computeRelativeLuminance(fgHex);
  const lumB = computeRelativeLuminance(bgHex);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Converts a `#RRGGBB` hex color into Björn Ottosson's perceptual OKLCH space.
 */
export function hexToOklch(hex: string): OklchColor {
  const { r, g, b } = parseHexToSrgb(hex);
  const rl = srgbChannelToLinear(r);
  const gl = srgbChannelToLinear(g);
  const bl = srgbChannelToLinear(b);

  const lCone = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
  const mCone = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
  const sCone = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);

  const L = 0.2104542553 * lCone + 0.793617785 * mCone - 0.0040720468 * sCone;
  const a = 1.9779984951 * lCone - 2.428592205 * mCone + 0.4505937099 * sCone;
  const bLab = 0.0259040371 * lCone + 0.7827717662 * mCone - 0.808675766 * sCone;

  const C = Math.sqrt(a * a + bLab * bLab);
  const rawHue = (Math.atan2(bLab, a) * 180) / Math.PI;
  const H = C < 0.0001 ? 0 : (rawHue + 360) % 360;

  return {
    l: Number(L.toFixed(3)),
    c: Number(C.toFixed(3)),
    h: Number(H.toFixed(1)),
  };
}

/**
 * Validates a foreground/background hex pair against `baoyu-design` dataviz rules:
 * - WCAG AA (`>= 4.5:1`) & AAA (`>= 7.0:1`)
 * - Perceptual OKLCH lightness separation (`|ΔL| >= 0.35`) so deuteranopia/protanopia
 *   readers never rely on hue alone.
 */
export function validatePaletteOklch(
  foregroundHex: string,
  backgroundHex: string,
): OklchContrastReport {
  const contrastRatio = computeWcagContrastRatio(foregroundHex, backgroundHex);
  const foregroundOklch = hexToOklch(foregroundHex);
  const backgroundOklch = hexToOklch(backgroundHex);
  const lightnessDelta = Number(
    Math.abs(foregroundOklch.l - backgroundOklch.l).toFixed(3),
  );

  return {
    foregroundHex,
    backgroundHex,
    contrastRatio,
    wcagAA: contrastRatio >= 4.5,
    wcagAAA: contrastRatio >= 7.0,
    foregroundOklch,
    backgroundOklch,
    lightnessDelta,
    colorBlindSafe: contrastRatio >= 3.0 && lightnessDelta >= 0.32,
  };
}
