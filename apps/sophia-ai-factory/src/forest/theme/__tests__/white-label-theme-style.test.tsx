/**
 * Adversarial Unit & Stress Test Suite: <WhiteLabelThemeStyle /> & Theme Rendering
 *
 * Scope:
 * 1. Extreme color values: pure black #000000, pure white #FFFFFF, bright yellow #FFFF00,
 *    neon green, transparent, invalid hex codes (#12, red, <script>, url(...))
 * 2. WCAG 2.1 AA luminance contrast calculations: dark backgrounds choose white text,
 *    bright backgrounds choose dark text across full spectrum
 * 3. <WhiteLabelThemeStyle /> defensive escaping: prevents breakout with </style><script>alert(1)</script>
 *
 * @module forest/theme/__tests__/white-label-theme-style.test
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { WhiteLabelThemeStyle } from '../white-label-theme-style';
import {
  normalizeHexColor,
  hexToRgb,
  rgbToHsl,
  calculateRelativeLuminance,
  computeContrastColor,
  resolveThemeCssVariables,
  buildThemeCssString,
  CANONICAL_THEME_FALLBACKS,
} from '@/tree/branding/theme-resolver';

describe('WhiteLabelThemeStyle Component & Dynamic Theme Stress Tests', () => {
  // =========================================================================
  // 1. <WhiteLabelThemeStyle /> SSR Escaping & Breakout Prevention
  // =========================================================================
  describe('<WhiteLabelThemeStyle /> Component Defensive Escaping', () => {
    it('returns null when themeCss is null or empty', () => {
      const { container: nullContainer } = render(<WhiteLabelThemeStyle themeCss={null} />);
      expect(nullContainer.firstChild).toBeNull();

      const { container: emptyContainer } = render(<WhiteLabelThemeStyle themeCss="" />);
      expect(emptyContainer.firstChild).toBeNull();
    });

    it('renders style tag with correct ID and nonce attribute', () => {
      const css = ':root { --test-color: #6366F1; }';
      const nonce = 'rAnd0m-n0nc3-v4lu3';
      const { container } = render(<WhiteLabelThemeStyle themeCss={css} nonce={nonce} />);

      const styleEl = container.querySelector('style#whitelabel-brand-theme');
      expect(styleEl).not.toBeNull();
      expect(styleEl?.getAttribute('nonce')).toBe(nonce);
      expect(styleEl?.textContent).toContain('--test-color: #6366F1');
    });

    it('defensively neutralizes classic </style><script>alert(1)</script> breakout', () => {
      const breakoutPayload = ':root { --brand: "</style><script>alert(1)</script>"; }';
      const { container } = render(<WhiteLabelThemeStyle themeCss={breakoutPayload} />);

      // In HTML DOM, there must be NO script tag injected
      const scriptElements = container.querySelectorAll('script');
      expect(scriptElements.length).toBe(0);

      // The style tag must remain intact
      const styleEl = container.querySelector('style#whitelabel-brand-theme');
      expect(styleEl).not.toBeNull();

      // The unescaped closing </style sequence must NOT exist; it must be escaped to <\/style
      const rawHtml = container.innerHTML;
      expect(rawHtml).not.toContain('</style><script>');
      expect(rawHtml).toContain('<\\/style><script>alert(1)</script>');
    });

    it('handles case-insensitive and whitespace variations of </style> closing tags', () => {
      const attackVectors = [
        ':root { --a: "</STYLE><script>alert(2)</script>"; }',
        ':root { --b: "</Style ><script>alert(3)</script>"; }',
        ':root { --c: "</style\n><script>alert(4)</script>"; }',
        ':root { --d: "</style/x><script>alert(5)</script>"; }',
        ':root { --e: "</style\t><script>alert(6)</script>"; }',
      ];

      for (const vector of attackVectors) {
        const { container } = render(<WhiteLabelThemeStyle themeCss={vector} />);
        expect(container.querySelectorAll('script').length).toBe(0);
        expect(container.innerHTML).not.toMatch(/<\/style[\s\S]*<script>/i);
      }
    });

    it('end-to-end: neutralizes malicious branding inputs through resolver and style component', () => {
      const maliciousBranding = {
        agencyName: 'Malicious Corp</style><script>alert("agency")</script>',
        logoUrl: 'https://evil.com/logo.png</style><script>alert("logo")</script>',
        faviconUrl: 'https://evil.com/fav.ico</style><script>alert("fav")</script>',
        primaryColor: '</style><script>alert("color")</script>',
        accentColor: '"><script>alert("accent")</script>',
      };

      const generatedCss = buildThemeCssString(maliciousBranding);
      const { container } = render(<WhiteLabelThemeStyle themeCss={generatedCss} nonce="test-nonce" />);

      // Zero script tags in DOM
      expect(container.querySelectorAll('script').length).toBe(0);

      // Style tag is valid and contains sanitized values
      const styleEl = container.querySelector('style#whitelabel-brand-theme');
      expect(styleEl).not.toBeNull();
      expect(styleEl?.textContent).not.toContain('<script>');
      expect(styleEl?.textContent).not.toContain('</script>');
    });
  });

  // =========================================================================
  // 2. Extreme Color Values
  // =========================================================================
  describe('Extreme Color Values & Edge Case Normalization', () => {
    it('handles pure black (#000000) correctly', () => {
      const normalized = normalizeHexColor('#000000');
      expect(normalized).toBe('#000000');

      const rgb = hexToRgb(normalized);
      expect(rgb).toEqual({ r: 0, g: 0, b: 0 });

      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      expect(hsl).toEqual({ h: 0, s: 0, l: 0 });

      const contrast = computeContrastColor(normalized);
      expect(contrast.isLightForeground).toBe(true);
      expect(contrast.hex).toBe(CANONICAL_THEME_FALLBACKS.white); // #FFFFFF text
      expect(contrast.luminance).toBe(0);

      const vars = resolveThemeCssVariables({ primaryColor: '#000000' });
      expect(vars['--brand-primary']).toBe('#000000');
      expect(vars['--brand-primary-contrast']).toBe(CANONICAL_THEME_FALLBACKS.white);
      expect(vars['--primary-foreground']).toBe('0 0% 100%'); // HSL white
    });

    it('handles pure white (#FFFFFF) correctly', () => {
      const normalized = normalizeHexColor('#FFFFFF');
      expect(normalized).toBe('#FFFFFF');

      const rgb = hexToRgb(normalized);
      expect(rgb).toEqual({ r: 255, g: 255, b: 255 });

      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      expect(hsl).toEqual({ h: 0, s: 0, l: 100 });

      const contrast = computeContrastColor(normalized);
      expect(contrast.isLightForeground).toBe(false);
      expect(contrast.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground); // #08090D text
      expect(contrast.luminance).toBeCloseTo(1.0, 4);

      const vars = resolveThemeCssVariables({ primaryColor: '#FFFFFF' });
      expect(vars['--brand-primary']).toBe('#FFFFFF');
      expect(vars['--brand-primary-contrast']).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);
    });

    it('handles bright yellow (#FFFF00) correctly', () => {
      const normalized = normalizeHexColor('#FFFF00');
      expect(normalized).toBe('#FFFF00');

      const contrast = computeContrastColor(normalized);
      expect(contrast.isLightForeground).toBe(false);
      expect(contrast.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground); // #08090D dark text
      expect(contrast.luminance).toBeCloseTo(0.9278, 3);

      const vars = resolveThemeCssVariables({ primaryColor: '#FFFF00' });
      expect(vars['--brand-primary-contrast']).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);
    });

    it('handles neon green (#00FF00, #0f0, and string "neon green")', () => {
      // 6-digit hex
      const normalized6 = normalizeHexColor('#00FF00');
      expect(normalized6).toBe('#00FF00');
      const contrast6 = computeContrastColor(normalized6);
      expect(contrast6.isLightForeground).toBe(false); // Must use dark text
      expect(contrast6.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);

      // 3-digit shorthand #0f0
      const normalized3 = normalizeHexColor('#0f0');
      expect(normalized3).toBe('#00FF00');
      const contrast3 = computeContrastColor(normalized3);
      expect(contrast3.isLightForeground).toBe(false);
      expect(contrast3.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);

      // Named color "neon green" should fallback safely to canonical primary
      const fallback = normalizeHexColor('neon green');
      expect(fallback).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
    });

    it('handles "transparent" and transparent color representations', () => {
      // Named color "transparent"
      expect(normalizeHexColor('transparent')).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);

      // rgba(0,0,0,0)
      expect(normalizeHexColor('rgba(0,0,0,0)')).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);

      // 8-digit hex with 00 alpha (#00000000)
      expect(normalizeHexColor('#00000000')).toBe('#000000');
      // 8-digit hex with full alpha (#FFFFFFFF)
      expect(normalizeHexColor('#FFFFFFFF')).toBe('#FFFFFF');
    });

    it('deterministically rejects and falls back for invalid hex codes', () => {
      const invalidCodes = [
        '#12',           // 2-digit hex
        'red',           // CSS named color
        '<script>',      // XSS payload
        'url(...)',      // CSS function
        '#1',            // 1-digit hex
        '#1234',         // 4-digit hex
        '#12345',        // 5-digit hex
        '#1234567',      // 7-digit hex
        '#123456789',    // 9-digit hex
        '#ZZZZZZ',       // Non-hex characters
        '#12G456',       // Invalid character in middle
        'javascript:void(0)',
        'expression(alert(1))',
        'rgb(255, 255, 0)',
        'hsl(60, 100%, 50%)',
      ];

      for (const code of invalidCodes) {
        expect(normalizeHexColor(code)).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
      }
    });
  });

  // =========================================================================
  // 3. WCAG 2.1 AA Contrast Ratio Calculations
  // =========================================================================
  describe('WCAG 2.1 AA Luminance Contrast Calculations', () => {
    it('ensures dark backgrounds choose white text with high contrast ratio', () => {
      const darkColors = [
        { hex: '#000000', name: 'Pure Black' },
        { hex: '#08090D', name: 'Deep Obsidian' },
        { hex: '#000080', name: 'Navy Blue' },
        { hex: '#1E1B4B', name: 'Dark Indigo' },
        { hex: '#312E81', name: 'Indigo 900' },
        { hex: '#4C1D95', name: 'Purple 900' },
        { hex: '#064E3B', name: 'Emerald 900' },
        { hex: '#1F2937', name: 'Gray 800' },
      ];

      for (const { hex, name } of darkColors) {
        const contrast = computeContrastColor(hex);
        expect(contrast.isLightForeground, `${name} (${hex}) should choose white text`).toBe(true);
        expect(contrast.hex).toBe(CANONICAL_THEME_FALLBACKS.white);

        // Contrast with white: (1.0 + 0.05) / (lum + 0.05)
        const ratio = (1.0 + 0.05) / (contrast.luminance + 0.05);
        expect(ratio, `${name} contrast ratio with white must pass WCAG AA (>= 4.5:1)`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('ensures bright backgrounds choose dark text with high contrast ratio', () => {
      const brightColors = [
        { hex: '#FFFFFF', name: 'Pure White' },
        { hex: '#FFFF00', name: 'Pure Yellow' },
        { hex: '#00FF00', name: 'Lime Green' },
        { hex: '#00FFFF', name: 'Cyan' },
        { hex: '#FACC15', name: 'Amber 400' },
        { hex: '#FEF08A', name: 'Yellow 200' },
        { hex: '#BBF7D0', name: 'Green 200' },
        { hex: '#E2E8F0', name: 'Slate 200' },
      ];

      const darkRgb = hexToRgb(CANONICAL_THEME_FALLBACKS.darkBackground);
      const darkLum = calculateRelativeLuminance(darkRgb);

      for (const { hex, name } of brightColors) {
        const contrast = computeContrastColor(hex);
        expect(contrast.isLightForeground, `${name} (${hex}) should choose dark text`).toBe(false);
        expect(contrast.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground);

        // Contrast with dark text: (lum + 0.05) / (darkLum + 0.05)
        const ratio = (contrast.luminance + 0.05) / (darkLum + 0.05);
        expect(ratio, `${name} contrast ratio with dark text must pass WCAG AA (>= 4.5:1)`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('verifies that no color across sampled RGB space falls below WCAG UI component threshold (3.0:1)', () => {
      const darkRgb = hexToRgb(CANONICAL_THEME_FALLBACKS.darkBackground);
      const darkLum = calculateRelativeLuminance(darkRgb);
      const whiteLum = 1.0;

      // Sample a grid across RGB cube
      const steps = [0, 51, 102, 153, 204, 255];
      for (const r of steps) {
        for (const g of steps) {
          for (const b of steps) {
            const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            const contrast = computeContrastColor(hex);
            const fgLum = contrast.isLightForeground ? whiteLum : darkLum;
            const maxLum = Math.max(contrast.luminance, fgLum);
            const minLum = Math.min(contrast.luminance, fgLum);
            const ratio = (maxLum + 0.05) / (minLum + 0.05);

            expect(ratio, `Color ${hex} must achieve at least 3.0:1 contrast`).toBeGreaterThanOrEqual(3.0);
          }
        }
      }
    });
  });
});
