import { describe, it, expect } from 'vitest';
import {
  normalizeHexColor,
  hexToRgb,
  rgbToHsl,
  calculateRelativeLuminance,
  computeContrastColor,
  generateShadeScale,
  resolveThemeCssVariables,
  buildThemeCssString,
  CANONICAL_THEME_FALLBACKS,
} from '../theme-resolver';

describe('theme-resolver', () => {
  describe('normalizeHexColor', () => {
    it('normalizes 6-digit hex color with #', () => {
      expect(normalizeHexColor('#6366F1')).toBe('#6366F1');
      expect(normalizeHexColor('6366f1')).toBe('#6366F1');
    });

    it('expands 3-digit shorthand hex (#abc -> #AABBCC)', () => {
      expect(normalizeHexColor('#fff')).toBe('#FFFFFF');
      expect(normalizeHexColor('123')).toBe('#112233');
    });

    it('returns canonical fallback on invalid inputs', () => {
      expect(normalizeHexColor('invalid')).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
      expect(normalizeHexColor(null)).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
      expect(normalizeHexColor(undefined)).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
    });
  });

  describe('hexToRgb & rgbToHsl', () => {
    it('converts hex to RGB channels correctly', () => {
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#6366F1')).toEqual({ r: 99, g: 102, b: 241 });
    });

    it('converts RGB to HSL correctly', () => {
      const hsl = rgbToHsl(99, 102, 241);
      expect(hsl.h).toBe(239);
      expect(hsl.s).toBe(84);
      expect(hsl.l).toBe(67);
    });
  });

  describe('calculateRelativeLuminance & computeContrastColor', () => {
    it('calculates WCAG 2.1 relative luminance', () => {
      const whiteLum = calculateRelativeLuminance({ r: 255, g: 255, b: 255 });
      const blackLum = calculateRelativeLuminance({ r: 0, g: 0, b: 0 });

      expect(whiteLum).toBeCloseTo(1.0, 2);
      expect(blackLum).toBeCloseTo(0.0, 2);
    });

    it('selects white foreground for dark/rich backgrounds', () => {
      const indigoContrast = computeContrastColor('#6366F1');
      expect(indigoContrast.hex).toBe(CANONICAL_THEME_FALLBACKS.white);
      expect(indigoContrast.isLightForeground).toBe(true);

      const purpleContrast = computeContrastColor('#7C3AED');
      expect(purpleContrast.hex).toBe(CANONICAL_THEME_FALLBACKS.white);
      expect(purpleContrast.isLightForeground).toBe(true);
    });

    it('selects dark obsidian foreground for light backgrounds to ensure WCAG AA compliance', () => {
      const whiteContrast = computeContrastColor('#FFFFFF');
      expect(whiteContrast.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);
      expect(whiteContrast.isLightForeground).toBe(false);

      const yellowContrast = computeContrastColor('#FACC15');
      expect(yellowContrast.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);
      expect(yellowContrast.isLightForeground).toBe(false);
    });
  });

  describe('generateShadeScale', () => {
    it('generates 10 lightness shades from 50 to 900', () => {
      const shades = generateShadeScale({ h: 239, s: 84, l: 67 });
      const expectedKeys = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

      expect(Object.keys(shades)).toEqual(expectedKeys);
      expect(shades['500']).toBe('239 84% 67%');
      expect(shades['50']).toContain('96%');
    });
  });

  describe('resolveThemeCssVariables & buildThemeCssString', () => {
    it('resolves complete CSS variables with primary, accent, and brand tokens', () => {
      const vars = resolveThemeCssVariables({
        primaryColor: '#7C3AED',
        accentColor: '#10B981',
        agencyName: 'Alpha Video Studio',
        logoUrl: 'https://example.com/logo.png',
      });

      expect(vars['--brand-primary']).toBe('#7C3AED');
      expect(vars['--brand-accent']).toBe('#10B981');
      expect(vars['--brand-agency-name']).toBe('"Alpha Video Studio"');
      expect(vars['--brand-logo-url']).toBe('url("https://example.com/logo.png")');
      expect(vars['--primary']).toBeDefined();
      expect(vars['--accent']).toBeDefined();
      expect(vars['--primary-500']).toBeDefined();
    });

    it('sanitizes agencyName and URLs against HTML style tag breakout', () => {
      const vars = resolveThemeCssVariables({
        agencyName: 'Malicious </style><script>alert(1)</script>',
        logoUrl: 'https://example.com/logo.png</style>',
      });

      expect(vars['--brand-agency-name']).not.toContain('</style');
      expect(vars['--brand-agency-name']).not.toContain('<script');
      expect(vars['--brand-logo-url']).not.toContain('</style');
    });

    it('strips raw newlines in brand parameters to prevent CSS bad-string-token', () => {
      const vars = resolveThemeCssVariables({
        agencyName: 'Line 1\r\nLine 2\nLine 3',
      });

      expect(vars['--brand-agency-name']).not.toContain('\r');
      expect(vars['--brand-agency-name']).not.toContain('\n');
      expect(vars['--brand-agency-name']).toBe('"Line 1  Line 2 Line 3"');
    });

    it('builds valid CSS block for :root and .dark selectors', () => {
      const css = buildThemeCssString({
        primaryColor: '#6366F1',
        accentColor: '#F59E0B',
      });

      expect(css).toContain(':root, .dark {');
      expect(css).toContain('--primary:');
      expect(css).toContain('--accent:');
      expect(css).toContain('--brand-primary: #6366F1');
      expect(css).toContain('--brand-accent: #F59E0B');
      expect(css.endsWith('}')).toBe(true);
    });

    it('strips angle brackets in buildThemeCssString to prevent SSR style tag breakout', () => {
      const css = buildThemeCssString({
        agencyName: 'Injected </style><script>',
      });

      expect(css).not.toContain('<');
      expect(css).not.toContain('>');
      expect(css).not.toContain('</style>');
    });
  });
});
