/**
 * Theme Resolver Types and Constants
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/branding/theme-resolver/types
 */

export type { BrandingSettings } from '@/seed/tenant-settings/defaults';
export type {
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
