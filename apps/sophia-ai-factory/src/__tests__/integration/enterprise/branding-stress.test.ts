/**
 * Adversarial Stress Test Suite: Dynamic Theme Resolver & White-Label Email Formatter.
 *
 * Empirically challenges:
 * 1. CSS variable injection attack vectors (; } body { display:none }, quote escapes, unicode, HTML style breakout, CRLF)
 * 2. Extreme color palettes & WCAG 2.1 contrast ratio calculations (yellow, lime green, navy blue, midtones, shorthand hex)
 * 3. White-label email HTML formatting & security hardening (XSS injection, javascript: hrefs, regex token corruption)
 * 4. Architectural consistency & branding parity between theme-resolver and email-styler
 *
 * @module tests/integration/enterprise/branding-stress
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
import {
  formatWhiteLabelEmail,
  formatWhiteLabelPlainText,
  wrapWithAgencyBranding,
  escapeHtml,
  getContrastTextColor,
} from '@/tree/branding/email-styler';

describe('Branding & Theme Engine — Adversarial Stress Test Suite', () => {
  // =========================================================================
  // 1. CSS Variable Injection & Syntax Breakout Attacks
  // =========================================================================
  describe('1. CSS Variable Injection & Syntax Breakout Attacks', () => {
    it('neutralizes classic CSS breakout payload (; } body { display:none })', () => {
      const maliciousPayload = '; } body { display:none !important; } /*';
      const vars = resolveThemeCssVariables({
        agencyName: `Acme Corp ${maliciousPayload}`,
        logoUrl: `https://example.com/logo.png${maliciousPayload}`,
        faviconUrl: `https://example.com/favicon.ico${maliciousPayload}`,
      });

      const css = buildThemeCssString({
        agencyName: `Acme Corp ${maliciousPayload}`,
        logoUrl: `https://example.com/logo.png${maliciousPayload}`,
        faviconUrl: `https://example.com/favicon.ico${maliciousPayload}`,
      });

      // Braces {} and semicolons ; must be stripped
      expect(vars['--brand-agency-name']).not.toContain(';');
      expect(vars['--brand-agency-name']).not.toContain('{');
      expect(vars['--brand-agency-name']).not.toContain('}');
      expect(vars['--brand-logo-url']).not.toContain(';');
      expect(vars['--brand-logo-url']).not.toContain('{');
      expect(vars['--brand-logo-url']).not.toContain('}');

      // The resulting CSS text must have only one outer rule block
      const openBraces = (css.match(/\{/g) || []).length;
      const closeBraces = (css.match(/\}/g) || []).length;
      expect(openBraces).toBe(1);
      expect(closeBraces).toBe(1);
    });

    it('handles quote escapes (double quotes, single quotes, backslashes)', () => {
      const maliciousPayload = 'Test "Double" and \'Single\' and \\Backslash\\';
      const vars = resolveThemeCssVariables({
        agencyName: maliciousPayload,
      });

      // Double quotes and backslashes must be stripped
      expect(vars['--brand-agency-name']).toBe('"Test Double and \'Single\' and Backslash"');
      expect(vars['--brand-agency-name']).not.toContain('\\');
    });

    it('neutralizes unicode escape sequences by stripping backslashes', () => {
      // CSS unicode escape sequences: \003b is ';', \007d is '}', \0022 is '"'
      const unicodePayload = 'Brand\\003b\\0020body\\007bdisplay:none\\007d';
      const vars = resolveThemeCssVariables({
        agencyName: unicodePayload,
      });

      // Stripping backslashes neutralizes CSS unicode escapes
      expect(vars['--brand-agency-name']).not.toContain('\\');
      expect(vars['--brand-agency-name']).toBe('"Brand003b0020body007bdisplay:none007d"');
    });

    it('neutralizes HTML style tag breakout vulnerability in buildThemeCssString', () => {
      // If agencyName or logoUrl contains </style><script>, buildThemeCssString neutralizes it
      const htmlBreakout = 'Agency</style><script>alert("XSS")</script>';
      const css = buildThemeCssString({
        agencyName: htmlBreakout,
        logoUrl: `https://cdn.com/logo.png</style><img src=x onerror=alert(1)>`,
      });

      // Stripping '<', '>', and '</style>' neutralizes HTML style tag breakout
      const containsStyleClosing = css.includes('</style>');
      const containsScriptTag = css.includes('<script>');

      expect(containsStyleClosing).toBe(false);
      expect(containsScriptTag).toBe(false);
    });

    it('evaluates closing parenthesis breakout in logoUrl url(...) declaration', () => {
      // Logo URL attempting to break out of url("...") via closing parenthesis
      const parenBreakout = 'https://cdn.example.com/logo.png) !important; --injected: 1';
      const vars = resolveThemeCssVariables({
        logoUrl: parenBreakout,
      });

      // Semicolon is stripped, but parenthesis is retained
      expect(vars['--brand-logo-url']).not.toContain(';');
      expect(vars['--brand-logo-url']).toContain('https://cdn.example.com/logo.png) !important --injected: 1');
    });

    it('evaluates raw newline injection in CSS variable declarations', () => {
      const multilinePayload = 'Acme Corp\n--evil-var: red;\nbody';
      const vars = resolveThemeCssVariables({
        agencyName: multilinePayload,
      });

      // Raw newlines are replaced with spaces to prevent bad-string-token, semicolons stripped
      expect(vars['--brand-agency-name']).not.toContain('\n');
      expect(vars['--brand-agency-name']).toBe('"Acme Corp --evil-var: red body"');
      expect(vars['--brand-agency-name']).not.toContain(';');
    });

    it('prevents CSS property injection through color parameters', () => {
      const maliciousColor = '#6366F1; display: none; background: url(http://evil.com)';
      const vars = resolveThemeCssVariables({
        primaryColor: maliciousColor,
        accentColor: maliciousColor,
      });

      // Invalid hex format fails regex and falls back to canonical defaults
      expect(vars['--brand-primary']).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
      expect(vars['--brand-accent']).toBe(CANONICAL_THEME_FALLBACKS.accentColor);
      expect(vars['--brand-primary']).not.toContain(';');
      expect(vars['--brand-primary']).not.toContain('display');
    });
  });

  // =========================================================================
  // 2. Extreme Color Palettes & WCAG 2.1 Contrast Calculations
  // =========================================================================
  describe('2. Extreme Color Palettes & WCAG 2.1 Contrast Calculations', () => {
    it('calculates accurate W3C relative luminance for extreme boundaries', () => {
      // Pure Black: 0.0
      expect(calculateRelativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
      // Pure White: 1.0
      expect(calculateRelativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1.0);
      // Pure Yellow (#FFFF00): ~0.9278
      const yellowLum = calculateRelativeLuminance(hexToRgb('#FFFF00'));
      expect(yellowLum).toBeCloseTo(0.9278, 3);
      // Pure Lime (#00FF00): ~0.7152
      const limeLum = calculateRelativeLuminance(hexToRgb('#00FF00'));
      expect(limeLum).toBeCloseTo(0.7152, 3);
      // Navy Blue (#000080): ~0.0156
      const navyLum = calculateRelativeLuminance(hexToRgb('#000080'));
      expect(navyLum).toBeCloseTo(0.0156, 3);
    });

    it('selects WCAG AAA compliant text on Pure Yellow (#FFFF00)', () => {
      const yellowContrast = computeContrastColor('#FFFF00');
      expect(yellowContrast.isLightForeground).toBe(false);
      expect(yellowContrast.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground); // #08090D

      // Contrast ratio with dark obsidian: (0.9278 + 0.05) / (0.00275 + 0.05) ~= 18.5:1
      const darkRgb = hexToRgb(CANONICAL_THEME_FALLBACKS.darkBackground);
      const darkLum = calculateRelativeLuminance(darkRgb);
      const actualRatio = (yellowContrast.luminance + 0.05) / (darkLum + 0.05);
      expect(actualRatio).toBeGreaterThan(15.0); // Far exceeds WCAG AAA (7.0:1)
    });

    it('selects WCAG AAA compliant text on Navy Blue (#000080)', () => {
      const navyContrast = computeContrastColor('#000080');
      expect(navyContrast.isLightForeground).toBe(true);
      expect(navyContrast.hex).toBe(CANONICAL_THEME_FALLBACKS.white); // #FFFFFF

      // Contrast ratio with white: (1.0 + 0.05) / (0.0156 + 0.05) ~= 16.0:1
      expect(navyContrast.contrastRatioWithWhite).toBeGreaterThan(15.0); // Far exceeds WCAG AAA (7.0:1)
    });

    it('verifies WCAG AA contrast compliance for Lime Green (#00FF00) in email-styler', () => {
      // In theme-resolver.ts:
      const themeLime = computeContrastColor('#00FF00');
      expect(themeLime.isLightForeground).toBe(false);
      expect(themeLime.hex).toBe(CANONICAL_THEME_FALLBACKS.darkBackground); // Correctly dark text

      // In email-styler.ts with harmonized W3C relative luminance:
      // Lime Green relative luminance is ~0.7152, requiring dark text #09090b for AA compliance
      const emailLimeText = getContrastTextColor('#00FF00');
      expect(emailLimeText).toBe('#09090b'); // Remediated: selects dark text for neon lime green

      // Contrast ratio between Lime Green (#00FF00) and Dark Text (#09090b):
      const limeLuminance = calculateRelativeLuminance({ r: 0, g: 255, b: 0 });
      const contrastWithDark = (limeLuminance + 0.05) / (0.003 + 0.05);
      expect(contrastWithDark).toBeGreaterThan(10.0);
    });

    it('verifies WCAG AA contrast compliance for Emerald Green (#10B981) in email-styler', () => {
      // Emerald (#10B981) is a common brand color (luminance = 0.3639)
      const themeEmerald = computeContrastColor('#10B981');
      expect(themeEmerald.isLightForeground).toBe(false); // Selects dark text in theme resolver

      // In email-styler.ts:
      // Emerald luminance > 0.25, selects #09090b for WCAG AA compliance (>4.5:1)
      const emailEmeraldText = getContrastTextColor('#10B981');
      expect(emailEmeraldText).toBe('#09090b');
    });

    it('evaluates 3-digit hex normalization in email-styler', () => {
      // 3-digit shorthand #0f0 is normalized to #00FF00 in both theme-resolver and email-styler
      const normalizedInTheme = normalizeHexColor('#0f0');
      expect(normalizedInTheme).toBe('#00FF00');

      const emailHtml = formatWhiteLabelEmail('<p>Text</p>', { primaryColor: '#0f0' });
      expect(emailHtml).toContain('#00FF00');
      expect(emailHtml).not.toContain('#7c3aed'); // Primary color #00FF00 is preserved
    });

    it('robustly normalizes 8-digit RGBA hex colors', () => {
      expect(normalizeHexColor('#6366f1aa')).toBe('#6366F1');
      expect(normalizeHexColor('#00FF0080')).toBe('#00FF00');
      expect(normalizeHexColor('#00000000')).toBe('#000000');
    });

    it('handles all invalid color inputs deterministically with fallback', () => {
      const inputs = [
        '',
        '   ',
        null,
        undefined,
        'not-a-hex',
        'rgb(255,0,0)',
        'rgba(0,0,0,0.5)',
        'hsl(120, 100%, 50%)',
        '#1',
        '#12',
        '#1234',
        '#12345',
        '#1234567',
        '#123456789',
        '#GGGGGG',
        '###6366F1',
        '#',
      ];

      for (const input of inputs) {
        const result = normalizeHexColor(input);
        expect(result).toBe(CANONICAL_THEME_FALLBACKS.primaryColor);
      }
    });
  });

  // =========================================================================
  // 3. White-Label Email HTML Formatting & Security Hardening
  // =========================================================================
  describe('3. White-Label Email HTML Formatting & Security Hardening', () => {
    it('escapes XSS payloads in agencyName across all email injection locations', () => {
      const xssName = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';
      const formatted = formatWhiteLabelEmail('<p>Safe content</p>', {
        agencyName: xssName,
      });

      // Must NOT contain raw script or unescaped img tags from agencyName
      expect(formatted).not.toContain('<script>');
      expect(formatted).not.toContain('</script>');
      expect(formatted).not.toContain('<img src=x');

      // Must contain properly escaped HTML entities
      expect(formatted).toContain('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;');
      expect(formatted).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('escapes dangerous attributes in supportEmail', () => {
      const xssEmail = 'help" onmouseover="alert(1)" href="http://evil.com';
      const formatted = formatWhiteLabelEmail('<p>Safe content</p>', {
        supportEmail: xssEmail,
      });

      // Double quotes must be escaped to &quot; preventing attribute breakout
      expect(formatted).not.toContain('href="mailto:help"');
      expect(formatted).toContain('&quot;');
    });

    it('escapes HTML tags in legal entity disclaimer', () => {
      const xssDisclaimer = '<style>body{display:none}</style><iframe src="javascript:evil()"></iframe>';
      const formatted = formatWhiteLabelEmail('<p>Body</p>', {
        legalDisclaimer: xssDisclaimer,
      });

      expect(formatted).not.toContain('<style>body');
      expect(formatted).not.toContain('<iframe');
      expect(formatted).toContain('&lt;style&gt;');
      expect(formatted).toContain('&lt;iframe');
    });

    it('verifies URL scheme sanitization in unsubscribeUrl rejects javascript: URI', () => {
      // If an attacker sets unsubscribeUrl to a javascript: URI
      const jsUrl = 'javascript:alert(document.cookie)';
      const formatted = formatWhiteLabelEmail('<p>Body</p>', {
        unsubscribeUrl: jsUrl,
      });

      // Strictly rejected: no link with javascript: URI is rendered
      expect(formatted).not.toContain(`href="${jsUrl}"`);
      expect(formatted).not.toContain('alert(document.cookie)');
    });

    it('prevents HTML corruption via regex replacement tokens ($&, $1) in full HTML doc mode', () => {
      const fullDoc = '<!DOCTYPE html><html><body><p>Notification content</p></body></html>';
      const formatted = formatWhiteLabelEmail(fullDoc, {
        agencyName: 'Apex $& Studio',
      });

      // Using replacer function prevents $& from expanding to <body>
      expect(formatted).not.toContain('Apex <body>');
      expect(formatted).toContain('Apex $&amp; Studio');
      expect(formatted).toContain('<h1');
    });

    it('handles malformed HTML bodies without throwing exceptions', () => {
      const brokenBodies = [
        '',
        '<div><p>Unclosed paragraph',
        '<table><tr><td>Missing closures',
        'Plain text without any tags',
        '<<>>><<<///',
        '<!-- Unclosed comment',
      ];

      for (const body of brokenBodies) {
        expect(() => formatWhiteLabelEmail(body, { agencyName: 'Robust Agency' })).not.toThrow();
      }
    });

    it('verifies interface contract wrapWithAgencyBranding with complete edge-case branding', () => {
      const output = wrapWithAgencyBranding('<div>Dashboard Report</div>', {
        agencyName: 'Enterprise Media Corp',
        logoUrl: 'https://media.enterprise.com/logo.svg',
        primaryColor: '#6366F1',
        emailFooter: 'Confidential & Proprietary',
      });

      expect(output).toContain('Enterprise Media Corp');
      expect(output).toContain('https://media.enterprise.com/logo.svg');
      expect(output).toContain('#6366F1');
      expect(output).toContain('Confidential &amp; Proprietary');
      // Must not leak Sophia AI platform branding
      expect(output).not.toContain('Sophia AI Factory');
    });

    it('verifies plain text formatting with special characters and multiline text', () => {
      const plain = formatWhiteLabelPlainText('Line 1\nLine 2\n\nLine 3', {
        agencyName: 'Global Operations',
        supportEmail: 'ops@global.com',
        legalDisclaimer: 'Address: 100 Main St\nCity: Metropolis',
        unsubscribeUrl: 'https://global.com/unsub',
      });

      expect(plain).toContain('GLOBAL OPERATIONS');
      expect(plain).toContain('Line 1\nLine 2\n\nLine 3');
      expect(plain).toContain('Support: ops@global.com');
      expect(plain).toContain('Address: 100 Main St\nCity: Metropolis');
      expect(plain).toContain('Unsubscribe: https://global.com/unsub');
    });
  });
});
