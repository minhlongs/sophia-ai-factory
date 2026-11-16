/**
 * ZEN DESIGN OS v1.0 — Canonical DTCG 2025.10 Token Contract & WCAG 2.2 Contrast Verifier
 * Layer: seed (Pure foundational primitive; zero domain dependencies)
 *
 * @module seed/design-tokens
 */

import dtcgTokens from './zen-design-tokens.dtcg.json';

export type ZenThemeMode = 'dark' | 'light';

export type ZenSemanticColorRole = keyof typeof dtcgTokens.color.semantic.dark;

export type ZenMotionDurationRole = keyof typeof dtcgTokens.motion.duration;

export type ZenMotionEasingRole = keyof typeof dtcgTokens.motion.easing;

export const ZEN_DESIGN_TOKENS = dtcgTokens;

/**
 * Resolves a semantic hex color from the canonical DTCG token source.
 */
export function getZenSemanticColor(
  mode: ZenThemeMode,
  role: ZenSemanticColorRole,
): string {
  return dtcgTokens.color.semantic[mode][role].$value;
}

/**
 * Resolves a motion duration token (e.g., "150ms", "400ms").
 */
export function getZenMotionDuration(role: ZenMotionDurationRole): string {
  return dtcgTokens.motion.duration[role].$value;
}

/**
 * Formats a DTCG cubicBezier 4-tuple into a valid CSS `cubic-bezier(...)` string.
 */
export function getZenMotionEasingCss(role: ZenMotionEasingRole): string {
  const [x1, y1, x2, y2] = dtcgTokens.motion.easing[role].$value;
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

/**
 * Computes WCAG 2.2 relative luminance for a 6-digit hex color (#RRGGBB).
 */
export function getRelativeLuminance(hex: string): number {
  const clean = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Invalid 6-digit hex color: ${hex}`);
  }
  const toLinear = (channel: number): number => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(parseInt(clean.slice(0, 2), 16));
  const g = toLinear(parseInt(clean.slice(2, 4), 16));
  const b = toLinear(parseInt(clean.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes WCAG 2.2 contrast ratio between two 6-digit hex colors, rounded to 2 decimals.
 */
export function getWcagContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = getRelativeLuminance(foregroundHex);
  const l2 = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export interface WcagContrastAuditRow {
  mode: ZenThemeMode;
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  minRequired: number;
  passes: boolean;
}

/**
 * Audits core text and UI pairs across both Dark and Light themes against WCAG 2.2 AA.
 */
export function auditZenThemeContrast(mode: ZenThemeMode): WcagContrastAuditRow[] {
  const palette = dtcgTokens.color.semantic[mode];
  const pairs: Array<{
    pair: string;
    fg: ZenSemanticColorRole;
    bg: ZenSemanticColorRole;
    minRequired: number;
  }> = [
    { pair: 'on-surface / surface', fg: 'on-surface', bg: 'surface', minRequired: 4.5 },
    { pair: 'on-surface / surface-container', fg: 'on-surface', bg: 'surface-container', minRequired: 4.5 },
    { pair: 'on-surface-variant / surface', fg: 'on-surface-variant', bg: 'surface', minRequired: 4.5 },
    { pair: 'on-surface-variant / surface-container', fg: 'on-surface-variant', bg: 'surface-container', minRequired: 4.5 },
    { pair: 'primary-text / surface-container', fg: 'primary-text', bg: 'surface-container', minRequired: 4.5 },
    { pair: 'primary / surface-container', fg: 'primary', bg: 'surface-container', minRequired: 3.0 },
    { pair: 'on-primary / primary-solid', fg: 'on-primary', bg: 'primary-solid', minRequired: 4.5 },
    { pair: 'on-primary-container / primary-container', fg: 'on-primary-container', bg: 'primary-container', minRequired: 4.5 },
    { pair: 'success / surface-container', fg: 'success', bg: 'surface-container', minRequired: 4.5 },
    { pair: 'warning / surface-container', fg: 'warning', bg: 'surface-container', minRequired: 4.5 },
    { pair: 'error / surface-container', fg: 'error', bg: 'surface-container', minRequired: 4.5 },
    { pair: 'outline / surface', fg: 'outline', bg: 'surface', minRequired: 3.0 },
  ];

  return pairs.map(({ pair, fg, bg, minRequired }) => {
    const foreground = palette[fg].$value;
    const background = palette[bg].$value;
    const ratio = getWcagContrastRatio(foreground, background);
    return {
      mode,
      pair,
      foreground,
      background,
      ratio,
      minRequired,
      passes: ratio >= minRequired,
    };
  });
}
