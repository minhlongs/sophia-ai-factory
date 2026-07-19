/**
 * Stitch Design System - Design Tokens
 *
 * Maps Material Design 3 color system from Stitch designs
 * to Sophia's CSS variable-based theme system.
 *
 * Reference: /Users/macbook/opc-platform/stitch-*.html
 */

export const stitchColors = {
  // Primary palette - Indigo/Purple theme
  primary: 'var(--primary)',
  primaryContainer: 'var(--primary-container)',
  onPrimary: 'var(--primary-foreground)',
  onPrimaryContainer: 'var(--on-primary-container)',
  primaryFixed: 'var(--primary-fixed)',
  primaryFixedDim: 'var(--primary-fixed-dim)',
  onPrimaryFixed: 'var(--on-primary-fixed)',
  onPrimaryFixedVariant: 'var(--on-primary-fixed-variant)',
  inversePrimary: 'var(--inverse-primary)',

  // Secondary palette
  secondary: 'var(--secondary)',
  secondaryContainer: 'var(--secondary-container)',
  onSecondary: 'var(--on-secondary)',
  onSecondaryContainer: 'var(--on-secondary-container)',
  secondaryFixed: 'var(--secondary-fixed)',
  secondaryFixedDim: 'var(--secondary-fixed-dim)',
  onSecondaryFixed: 'var(--on-secondary-fixed)',
  onSecondaryFixedVariant: 'var(--on-secondary-fixed-variant)',

  // Tertiary palette - Cyan/Teal accent
  tertiary: 'var(--tertiary)',
  tertiaryContainer: 'var(--tertiary-container)',
  onTertiary: 'var(--on-tertiary)',
  onTertiaryContainer: 'var(--on-tertiary-container)',
  tertiaryFixed: 'var(--tertiary-fixed)',
  tertiaryFixedDim: 'var(--tertiary-fixed-dim)',
  onTertiaryFixed: 'var(--on-tertiary-fixed)',
  onTertiaryFixedVariant: 'var(--on-tertiary-fixed-variant)',

  // Surface colors
  surface: 'var(--background)',
  surfaceContainer: 'var(--card)',
  surfaceContainerLowest: 'var(--card)',
  surfaceContainerLow: 'var(--muted)',
  surfaceContainerHigh: 'var(--muted)',
  surfaceContainerHighest: 'var(--muted)',
  surfaceBright: 'var(--background-secondary)',
  surfaceDim: 'var(--muted)',
  surfaceVariant: 'var(--muted)',
  inverseSurface: 'var(--popover)',

  // Text/foreground colors
  onSurface: 'var(--foreground)',
  onSurfaceVariant: 'var(--muted-foreground)',
  inverseOnSurface: 'var(--popover-foreground)',

  // Background
  background: 'var(--background)',
  onBackground: 'var(--foreground)',

  // Outline and borders
  outline: 'var(--border)',
  outlineVariant: 'var(--border)',

  // Error states
  error: 'var(--destructive)',
  errorContainer: 'var(--destructive)',
  onError: 'var(--destructive-foreground)',
  onErrorContainer: 'var(--destructive-foreground)',
};

export const stitchSpacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
  'container-max': '1280px',
  gutter: '24px',
  'margin-mobile': '16px',
  'margin-desktop': '32px',
};

export const stitchBorderRadius = {
  DEFAULT: '0.25rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
};

export const stitchTypography = {
  // Display / Headline scale
  'display-lg': {
    fontSize: '48px',
    lineHeight: '1.1',
    fontWeight: '700',
    letterSpacing: '-0.02em',
  },
  'headline-xl': {
    fontSize: '36px',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '-0.02em',
  },
  'headline-lg': {
    fontSize: '32px',
    lineHeight: '1.2',
    fontWeight: '600',
    letterSpacing: '-0.01em',
  },
  'headline-lg-mobile': {
    fontSize: '24px',
    lineHeight: '1.2',
    fontWeight: '600',
    letterSpacing: '-0.01em',
  },
  'headline-md': {
    fontSize: '24px',
    lineHeight: '1.3',
    fontWeight: '600',
  },
  'headline-sm': {
    fontSize: '20px',
    lineHeight: '1.4',
    fontWeight: '600',
  },

  // Body text scale
  'body-lg': {
    fontSize: '18px',
    lineHeight: '1.6',
    fontWeight: '400',
  },
  'body-md': {
    fontSize: '16px',
    lineHeight: '1.5',
    fontWeight: '400',
  },
  'body-sm': {
    fontSize: '14px',
    lineHeight: '1.5',
    fontWeight: '400',
  },

  // Label scale
  'label-lg': {
    fontSize: '16px',
    lineHeight: '1.5',
    fontWeight: '500',
  },
  'label-md': {
    fontSize: '14px',
    lineHeight: '1',
    fontWeight: '500',
    letterSpacing: '0.01em',
  },
  'label-sm': {
    fontSize: '12px',
    lineHeight: '1',
    fontWeight: '600',
    letterSpacing: '0.02em',
  },

  // Code
  code: {
    fontSize: '14px',
    lineHeight: '1.5',
    fontWeight: '400',
    fontFamily: 'var(--font-jetbrains-mono), monospace',
  },
};

// Utility class names for Tailwind
export const stitchClasses = {
  // Colors
  bgPrimary: 'bg-primary',
  bgPrimaryContainer: 'bg-primary-container',
  bgSecondary: 'bg-secondary',
  bgSecondaryContainer: 'bg-secondary-container',
  bgSurface: 'bg-background',
  bgSurfaceContainer: 'bg-card',
  bgSurfaceContainerLowest: 'bg-card',
  bgOnPrimary: 'bg-primary-foreground',
  textOnSurface: 'text-foreground',
  textOnSurfaceVariant: 'text-muted-foreground',
  textOnPrimary: 'text-primary-foreground',
  textOnPrimaryContainer: 'text-on-primary-container',
  textPrimary: 'text-primary',
  borderOutline: 'border-border',
  borderOutlineVariant: 'border-border',
  textError: 'text-destructive',
  bgError: 'bg-destructive',

  // Typography
  fontDisplayLg: 'font-display-lg',
  fontHeadlineLg: 'font-headline-lg',
  fontHeadlineMd: 'font-headline-md',
  fontHeadlineSm: 'font-headline-sm',
  fontBodyLg: 'font-body-lg',
  fontBodyMd: 'font-body-md',
  fontBodySm: 'font-body-sm',
  fontLabelLg: 'font-label-lg',
  fontLabelMd: 'font-label-md',
  fontLabelSm: 'font-label-sm',
  fontCode: 'font-code',

  // Spacing
  pContainerMax: 'px-container-max',
  containerMax: 'max-w-container-max',
};

export default {
  colors: stitchColors,
  spacing: stitchSpacing,
  borderRadius: stitchBorderRadius,
  typography: stitchTypography,
  classes: stitchClasses,
};
