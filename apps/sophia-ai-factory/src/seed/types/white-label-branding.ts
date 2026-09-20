/**
 * White-Label Branding Data Contracts & Theme Tokens.
 *
 * Layer: seed (Foundational primitives)
 * Dependencies: seed/tenant-settings/defaults
 *
 * @module seed/types/white-label-branding
 */

import type { BrandingSettings, SocialMeta } from '@/seed/tenant-settings/defaults';
export type { BrandingSettings, SocialMeta };

export interface ResolvedTenantBranding {
  orgId: string;
  hostname: string;
  agencyName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  welcomeMessage: string | null;
  emailFromName: string | null;
  emailFooter: string | null;
  socialMeta: SocialMeta | null;
  watermarkPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  watermarkOpacity: number;
  watermarkPolicy: 'always' | 'master_plus' | 'never';
  isWhiteLabel: boolean;
}

export interface ContrastColorSpec {
  hex: string;
  hsl: string;
  luminance: number;
  contrastRatioWithWhite: number;
  isLightForeground: boolean; // true = white text, false = dark text
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface ThemeCssVariables {
  // Tailwind v4 Bridge Tokens
  '--primary': string;
  '--primary-foreground': string;
  '--primary-container': string;
  '--on-primary-container': string;
  '--ring': string;
  '--accent': string;
  '--accent-foreground': string;

  // Primary Palette Scale (50-900)
  '--primary-50': string;
  '--primary-100': string;
  '--primary-200': string;
  '--primary-300': string;
  '--primary-400': string;
  '--primary-500': string;
  '--primary-600': string;
  '--primary-700': string;
  '--primary-800': string;
  '--primary-900': string;

  // Accent Palette Scale (50-900)
  '--accent-50': string;
  '--accent-100': string;
  '--accent-200': string;
  '--accent-300': string;
  '--accent-400': string;
  '--accent-500': string;
  '--accent-600': string;
  '--accent-700': string;
  '--accent-800': string;
  '--accent-900': string;

  // Dedicated White-Label Brand Tokens
  '--brand-primary': string;
  '--brand-primary-rgb': string;
  '--brand-primary-hsl': string;
  '--brand-primary-contrast': string;
  '--brand-primary-contrast-hsl': string;
  '--brand-accent': string;
  '--brand-accent-rgb': string;
  '--brand-accent-hsl': string;
  '--brand-accent-contrast': string;
  '--brand-agency-name'?: string;
  '--brand-logo-url'?: string;
  '--brand-favicon-url'?: string;
}
