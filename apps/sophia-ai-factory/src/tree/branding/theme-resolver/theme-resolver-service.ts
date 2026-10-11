/**
 * Dynamic White-Label Theme Resolver Service
 *
 * Computes CSS variables, contrast ratios, and color scales from tenant brand kit.
 * Pure domain logic — strictly Layer 2 (Tree), importing only Seed.
 *
 * @module tree/branding/theme-resolver/theme-resolver-service
 */

import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { resolveThemeCssVariables } from './css-variable-mapper';

export {
  CANONICAL_THEME_FALLBACKS,
  type BrandingSettings,
  type ThemeCssVariables,
  type ContrastColorSpec,
  type RgbColor,
  type HslColor,
} from './types';

export {
  normalizeHexColor,
  hexToRgb,
  rgbToHsl,
  hexToHsl,
  calculateRelativeLuminance,
  computeContrastColor,
  formatHslChannels,
  generateShadeScale,
} from './color-palette-generator';

export {
  sanitizeCssVarValue,
  resolveThemeCssVariables,
} from './css-variable-mapper';

/**
 * Builds CSS style text suitable for direct SSR `<style>` injection.
 * Strips `<` and `>` characters to guarantee stored XSS style tag breakout immunity.
 */
export function buildThemeCssString(branding?: Partial<BrandingSettings> | null): string {
  const vars = resolveThemeCssVariables(branding);
  const declarations = Object.entries(vars)
    .map(([key, val]) => `  ${key}: ${val};`)
    .join('\n');

  const css = `:root, .dark {\n${declarations}\n}`;
  return css.replace(/[<>]/g, '');
}
