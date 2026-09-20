/**
 * Unit Tests for Dynamic White-Label Theme Resolver & WCAG 2.1 Contrast Calculations.
 *
 * Covers:
 * 1. Hex sanitization, 3-to-6 digit expansion, and fallback recovery
 * 2. RGB / HSL channel conversions and Tailwind v4 formatting
 * 3. WCAG 2.1 relative luminance and contrast ratio calculations
 * 4. Automatic high-contrast foreground selection (White vs Deep Obsidian)
 * 5. Full palette scale generation (50-900)
 * 6. Dynamic CSS variable resolution and SSR <style> block serialization
 * 7. Security: CSS breakout sanitization
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeHexColor,
  hexToRgb,
  rgbToHsl,
  hexToHsl,
  calculateRelativeLuminance,
  computeContrastColor,
  formatHslChannels,
  generateShadeScale,
  resolveThemeCssVariables,
  buildThemeCssString,
  CANONICAL_THEME_FALLBACKS,
} from '@/tree/branding/theme-resolver';

describe('Theme Resolver — Unit Tests', () => {
  describe('1. Hex Normalization', () => {
    it('normalizes 6-digit hex colors with leading #', () => {
      expect(normalizeHexColor('#6366f1')).toBe('#6366F1');
      expect(normalizeHexColor('  #10b981  ')).toBe('#10B981');
    });

    it('adds leading # if omitted', () => {
      expect(normalizeHexColor('f59e0b')).toBe('#F59E0B');
    });

    it('expands 3-digit shorthand hex (#RGB -> #RRGGBB)', () => {
      expect(normalizeHexColor('#fff')).toBe('#FFFFFF');
      expect(normalizeHexColor('#000')).toBe('#000000');
      expect(normalizeHexColor('#38f')).toBe('#3388FF');
    });

    it('handles 8-digit RGBA hex by taking first 6 digits', () => {
      expect(normalizeHexColor('#6366f1ff')).toBe('#6366F1');
    });

    it('falls back gracefully to canonical primary on invalid inputs', () => {
      expect(normalizeHexColor('')).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
      expect(normalizeHexColor(null)).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
      expect(normalizeHexColor(undefined)).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
      expect(normalizeHexColor('not-a-color')).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
      expect(normalizeHexColor('#12345')).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
    });

    it('uses custom fallback when provided', () => {
      expect(normalizeHexColor('invalid', '#123456')).toBe('#123456');
    });
  });

  describe('2. Color Conversions (RGB / HSL)', () => {
    it('converts hex to RGB channels correctly', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('converts RGB to HSL correctly', () => {
      const redHsl = rgbToHsl(255, 0, 0);
      expect(redHsl.h).toBe(0);
      expect(redHsl.s).toBe(100);
      expect(redHsl.l).toBe(50);

      const greenHsl = rgbToHsl(0, 255, 0);
      expect(greenHsl.h).toBe(120);
      expect(greenHsl.s).toBe(100);
      expect(greenHsl.l).toBe(50);

      const blueHsl = rgbToHsl(0, 0, 255);
      expect(blueHsl.h).toBe(240);
      expect(blueHsl.s).toBe(100);
      expect(blueHsl.l).toBe(50);
    });

    it('formats HSL channels for Tailwind v4 consumption', () => {
      expect(formatHslChannels({ h: 246, s: 80, l: 64 })).toBe('246 80% 64%');
    });
  });

  describe('3. WCAG 2.1 Contrast Calculations', () => {
    it('calculates relative luminance accurately according to W3C specs', () => {
      const blackLum = calculateRelativeLuminance({ r: 0, g: 0, b: 0 });
      expect(blackLum).toBe(0);

      const whiteLum = calculateRelativeLuminance({ r: 255, g: 255, b: 255 });
      expect(whiteLum).toBe(1.0);

      const indigoLum = calculateRelativeLuminance(hexToRgb('#6366F1'));
      expect(indigoLum).toBeGreaterThan(0.1);
      expect(indigoLum).toBeLessThan(0.3);
    });

    it('selects crisp white text for low-luminance (dark) backgrounds', () => {
      // Electric Indigo
      const indigo = computeContrastColor('#6366F1');
      expect(indigo.isLightForeground).toBe(true);
      expect(indigo.hex).toBe('#FFFFFF');
      expect(indigo.hsl).toBe('0 0% 100%');

      // Pure Black & Navy
      const black = computeContrastColor('#000000');
      expect(black.isLightForeground).toBe(true);
      expect(black.hex).toBe('#FFFFFF');

      const navy = computeContrastColor('#1E1B4B');
      expect(navy.isLightForeground).toBe(true);
      expect(navy.hex).toBe('#FFFFFF');
    });

    it('selects deep obsidian text for high-luminance (bright) backgrounds', () => {
      // Pure Yellow
      const yellow = computeContrastColor('#FFFF00');
      expect(yellow.isLightForeground).toBe(false);
      expect(yellow.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);

      // Cyber Amber (#F59E0B)
      const amber = computeContrastColor('#F59E0B');
      expect(amber.isLightForeground).toBe(false);
      expect(amber.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);

      // Bright Cyan
      const cyan = computeContrastColor('#00FFFF');
      expect(cyan.isLightForeground).toBe(false);
      expect(cyan.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);

      // Pure White
      const white = computeContrastColor('#FFFFFF');
      expect(white.isLightForeground).toBe(false);
      expect(white.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);
    });
  });

  describe('4. Palette Shade Scale Generation', () => {
    it('generates complete shade scale from 50 to 900', () => {
      const hsl = hexToHsl('#6366F1');
      const shades = generateShadeScale(hsl);

      expect(shades['50']).toBeDefined();
      expect(shades['100']).toBeDefined();
      expect(shades['500']).toBeDefined();
      expect(shades['900']).toBeDefined();

      // Ensure 50 is significantly lighter than 900
      const lightVal = parseInt(shades['50'].split(' ')[2]);
      const darkVal = parseInt(shades['900'].split(' ')[2]);
      expect(lightVal).toBeGreaterThan(darkVal);
    });
  });

  describe('5. CSS Variable Resolution & Theme String Serialization', () => {
    it('generates all required Tailwind v4 and white-label tokens', () => {
      const vars = resolveThemeCssVariables({
        primaryColor: '#059669', // Emerald
        accentColor: '#D97706',  // Amber
        agencyName: 'Apex Media Group',
        logoUrl: 'https://cdn.apex.com/logo.png',
        faviconUrl: 'https://cdn.apex.com/favicon.ico',
      });

      expect(vars['--primary']).toBeDefined();
      expect(vars['--primary-foreground']).toBeDefined();
      expect(vars['--accent']).toBeDefined();
      expect(vars['--accent-foreground']).toBeDefined();
      expect(vars['--ring']).toBeDefined();

      // Scales
      expect(vars['--primary-50']).toBeDefined();
      expect(vars['--primary-500']).toBeDefined();
      expect(vars['--accent-50']).toBeDefined();
      expect(vars['--accent-500']).toBeDefined();

      // Brand tokens
      expect(vars['--brand-primary']).toBe('#059669');
      expect(vars['--brand-primary-rgb']).toBe('5, 150, 105');
      expect(vars['--brand-agency-name']).toBe('"Apex Media Group"');
      expect(vars['--brand-logo-url']).toBe('url("https://cdn.apex.com/logo.png")');
      expect(vars['--brand-favicon-url']).toBe('url("https://cdn.apex.com/favicon.ico")');
    });

    it('sanitizes strings to prevent CSS breakout injection', () => {
      const vars = resolveThemeCssVariables({
        primaryColor: '#10B981',
        agencyName: 'Acme"; } body { background: red; } /*',
        logoUrl: 'https://example.com/logo.png"); } /*',
      });

      const innerAgencyName = vars['--brand-agency-name']?.slice(1, -1);
      expect(innerAgencyName).not.toContain(';');
      expect(innerAgencyName).not.toContain('"');
      expect(vars['--brand-logo-url']).not.toContain(';');
    });

    it('serializes to valid SSR CSS string block', () => {
      const cssString = buildThemeCssString({
        primaryColor: '#6366F1',
        accentColor: '#F59E0B',
      });

      expect(cssString).toContain(':root, .dark {');
      expect(cssString).toContain('--primary:');
      expect(cssString).toContain('--primary-foreground:');
      expect(cssString).toContain('--brand-primary: #6366F1;');
      expect(cssString).toContain('}');
    });
  });
});
