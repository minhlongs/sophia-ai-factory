/**
 * Empirical Challenger Test Suite: Milestone 1 Enterprise Remediation Verification
 *
 * Independent adversarial stress testing of:
 * 1. <style> tag breakout attacks and CSS injection vectors
 * 2. Regex `$` replacement tokens in email styler ($&, $', $`, $1, $$)
 * 3. W3C relative luminance and WCAG 2.1 AA contrast calculations across color palettes
 * 4. Hostname validation enforcing intermediate label hyphen boundaries & reserved domains
 */

import { describe, it, expect } from 'vitest';
import {
  resolveThemeCssVariables,
  buildThemeCssString,
  normalizeHexColor,
  calculateRelativeLuminance,
  computeContrastColor,
  hexToRgb,
  CANONICAL_THEME_FALLBACKS,
} from '@/tree/branding/theme-resolver';
import {
  formatWhiteLabelEmail,
  formatWhiteLabelPlainText,
  getContrastTextColor,
  isValidHttpUrl,
  escapeHtml,
} from '@/tree/branding/email-styler';
import { validateHostname } from '@/tree/custom-domains/verification-service';

describe('Empirical Challenger: Milestone 1 Remediations Adversarial Suite', () => {
  // ── 1. <style> Tag Breakout & CSS Injection Attacks ─────────────────────────
  describe('1. Adversarial <style> Tag Breakout Probing', () => {
    const breakoutPayloads = [
      '</style><script>alert("XSS")</script>',
      '</STYLE><script>alert(1)</script>',
      '</StYlE><script>alert(1)</script>',
      '</style ><script>alert(1)</script>',
      '</style\t><script>alert(1)</script>',
      '</style\n><script>alert(1)</script>',
      '</style/x><script>alert(1)</script>',
      '</style foo="bar"><script>alert(1)</script>',
      '"><script>alert(1)</script>',
      '\';alert(1);//',
      ';} body { display:none !important; } /*',
      'url("https://evil.com/x") !important; } /*',
      'Acme Corp </style><style>body{background:red}</style>',
      'Acme \\003c/style\\003e',
      'Acme </style type="text/css">',
      'Acme <\\/style>',
      'Acme <style>nested</style>',
    ];

    it.each(breakoutPayloads)('neutralizes style breakout attack: %s', (payload) => {
      const vars = resolveThemeCssVariables({
        agencyName: payload,
        logoUrl: `https://cdn.example.com/logo.png?v=${payload}`,
        faviconUrl: `https://cdn.example.com/icon.png?v=${payload}`,
      });

      const css = buildThemeCssString({
        agencyName: payload,
        logoUrl: `https://cdn.example.com/logo.png?v=${payload}`,
        faviconUrl: `https://cdn.example.com/icon.png?v=${payload}`,
      });

      // Assert that neither vars nor generated CSS contains raw closing style tags or unescaped angle brackets
      expect(css).not.toMatch(/<\/style/i);
      expect(css).not.toContain('<script');
      expect(css).not.toContain('<style');
      expect(vars['--brand-agency-name']).not.toContain('<');
      expect(vars['--brand-agency-name']).not.toContain('>');
      expect(vars['--brand-agency-name']).not.toContain(';');
      expect(vars['--brand-agency-name']).not.toContain('{');
      expect(vars['--brand-agency-name']).not.toContain('}');
      expect(vars['--brand-agency-name']).not.toContain('\\');

      // Verify the CSS block has exactly 1 open and 1 close brace
      const openBraces = (css.match(/\{/g) || []).length;
      const closeBraces = (css.match(/\}/g) || []).length;
      expect(openBraces).toBe(1);
      expect(closeBraces).toBe(1);
    });
  });

  // ── 2. Regex `$` Replacement Token Corruption Probing ────────────────────────
  describe('2. Adversarial Regex $ Token Replacement Probing', () => {
    const dollarTokens = [
      '$&',           // Matched substring (would expand to <body> or target)
      '$`',           // Text before match
      "$\\'",         // Text after match
      "$' in single quotes",
      '$1',           // Capture group 1
      '$2',           // Capture group 2
      '$99',          // Non-existent capture group
      '$$',           // Escaped dollar
      '$$&',          // Double escaped matched substring
      '$$1',          // Double escaped capture group
      '$-',           // Irregular token
      '$_',           // Irregular token
      '100$ discount',
      '$50 off coupon',
      'Apex $& Studio $1 and $\' and $`',
    ];

    it.each(dollarTokens)('prevents HTML corruption with token: %s in full HTML doc mode', (token) => {
      const fullDoc = '<!DOCTYPE html><html><head><title>Test</title></head><body><p>Hello World</p></body></html>';
      const formatted = formatWhiteLabelEmail(fullDoc, {
        agencyName: `Agency ${token}`,
        legalDisclaimer: `Disclaimer with ${token}`,
        emailFooter: `Footer with ${token}`,
      });

      // Must not corrupt body tags
      expect(formatted).toContain('<body>');
      expect(formatted).toContain('</body>');
      expect(formatted).not.toContain('<body>amp;');
      expect(formatted).not.toContain('Agency <body>');
      expect(formatted).not.toContain('Disclaimer with <body>');

      // The rendered HTML must contain properly escaped representations
      const escapedToken = escapeHtml(token);
      expect(formatted).toContain(escapedToken);
    });

    it.each(dollarTokens)('prevents corruption when token is in container mode: %s', (token) => {
      const fragment = `<p>Special offer: 50% discount</p>`;
      const formatted = formatWhiteLabelEmail(fragment, {
        agencyName: `Enterprise ${token}`,
        legalDisclaimer: `Terms: ${token}`,
      });

      expect(formatted).not.toContain('Enterprise <body>');
      expect(formatted).toContain(escapeHtml(`Enterprise ${token}`));
      expect(formatted).toContain('<!DOCTYPE html');
    });

    it('prevents plain text corruption with $ tokens', () => {
      const plain = formatWhiteLabelPlainText('Content body', {
        agencyName: 'Dollar $& Company',
        legalDisclaimer: 'Refunds: $1 fee applies',
        unsubscribeUrl: 'https://example.com/unsub?id=$1',
      });

      expect(plain).toContain('DOLLAR $& COMPANY');
      expect(plain).toContain('Refunds: $1 fee applies');
      expect(plain).toContain('Unsubscribe: https://example.com/unsub?id=$1');
    });
  });

  // ── 3. W3C Relative Luminance & WCAG 2.1 AA Contrast Probing ─────────────────
  describe('3. W3C Relative Luminance & WCAG AA Contrast Probing', () => {
    it('strictly enforces WCAG AA (>4.5:1) for Lime Green (#00FF00)', () => {
      const hex = '#00FF00';
      const textColor = getContrastTextColor(hex);
      expect(textColor).toBe('#09090b'); // Dark text required

      const bgRgb = hexToRgb(hex);
      const bgLum = calculateRelativeLuminance(bgRgb);
      const darkRgb = hexToRgb(textColor);
      const darkLum = calculateRelativeLuminance(darkRgb);

      const contrastRatio = (bgLum + 0.05) / (darkLum + 0.05);
      expect(contrastRatio).toBeGreaterThan(4.5);
      expect(contrastRatio).toBeGreaterThan(14.0);
      expect(contrastRatio).toBeCloseTo(14.5, 1);
    });

    it('strictly enforces WCAG AA (>4.5:1) for Emerald Green (#10B981)', () => {
      const hex = '#10B981';
      const textColor = getContrastTextColor(hex);
      expect(textColor).toBe('#09090b'); // Dark text required

      const bgRgb = hexToRgb(hex);
      const bgLum = calculateRelativeLuminance(bgRgb);
      const darkRgb = hexToRgb(textColor);
      const darkLum = calculateRelativeLuminance(darkRgb);

      const contrastRatio = (bgLum + 0.05) / (darkLum + 0.05);
      expect(contrastRatio).toBeGreaterThan(4.5);
      expect(contrastRatio).toBeGreaterThan(7.0); // Exceeds WCAG AAA
    });

    it('evaluates contrast for full palette of brand colors', () => {
      const palette = [
        { name: 'Pure White', hex: '#FFFFFF', expectedText: '#09090b' },
        { name: 'Pure Black', hex: '#000000', expectedText: '#ffffff' },
        { name: 'Yellow', hex: '#FFFF00', expectedText: '#09090b' },
        { name: 'Amber', hex: '#F59E0B', expectedText: '#09090b' },
        { name: 'Lime', hex: '#00FF00', expectedText: '#09090b' },
        { name: 'Emerald', hex: '#10B981', expectedText: '#09090b' },
        { name: 'Cyan', hex: '#00FFFF', expectedText: '#09090b' },
        { name: 'Navy', hex: '#000080', expectedText: '#ffffff' },
        { name: 'Deep Purple', hex: '#4C1D95', expectedText: '#ffffff' },
        { name: 'Charcoal', hex: '#18181B', expectedText: '#ffffff' },
      ];

      for (const color of palette) {
        const textColor = getContrastTextColor(color.hex);
        expect(textColor).toBe(color.expectedText);

        const bgLum = calculateRelativeLuminance(hexToRgb(color.hex));
        const fgLum = calculateRelativeLuminance(hexToRgb(textColor));
        const maxLum = Math.max(bgLum, fgLum);
        const minLum = Math.min(bgLum, fgLum);
        const ratio = (maxLum + 0.05) / (minLum + 0.05);

        // Every single color MUST achieve at least 4.5:1 WCAG AA
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('handles 3-character hex correctly (#0f0 -> #00FF00, #fff -> #FFFFFF)', () => {
      expect(normalizeHexColor('#0f0')).toBe('#00FF00');
      expect(normalizeHexColor('#fff')).toBe('#FFFFFF');
      expect(normalizeHexColor('#000')).toBe('#000000');
      expect(normalizeHexColor('#f00')).toBe('#FF0000');
      expect(getContrastTextColor('#0f0')).toBe('#09090b');
      expect(getContrastTextColor('#000')).toBe('#ffffff');
    });
  });

  // ── 4. Hostname Validation & Label Hyphen Boundary Probing ───────────────────
  describe('4. Adversarial Hostname Validation Probing', () => {
    describe('Intermediate and boundary hyphen rejections', () => {
      const invalidHyphenHostnames = [
        'portal.example-.com',         // Trailing hyphen on intermediate label
        'portal.-example.com',         // Leading hyphen on intermediate label
        'portal.example.com-',         // Trailing hyphen on TLD
        'portal.example.-com',         // Leading hyphen on TLD
        '-portal.example.com',         // Leading hyphen on first label
        'portal-.example.com',         // Trailing hyphen on first label
        'portal.-.com',                // Single hyphen label
        'portal.--.com',               // Double hyphen standalone label
        'sub.portal.my-domain-.net',   // Multi-level trailing hyphen
        'sub.portal.-my-domain.net',   // Multi-level leading hyphen
      ];

      it.each(invalidHyphenHostnames)('rejects invalid hyphen boundary: %s', (hostname) => {
        const result = validateHostname(hostname);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_HOSTNAME');
        }
      });
    });

    describe('Valid hyphenated hostnames acceptance', () => {
      const validHyphenHostnames = [
        'portal.my-agency.com',
        'portal.sub-brand.agency-hq.com',
        'portal.a-b-c.example.com',
        'portal.a--b.com',              // Consecutive hyphens inside label (punycode style)
        'xn--ls8h.test.com',            // IDN punycode
        'app.123-456.org',              // Digits and hyphens
      ];

      it.each(validHyphenHostnames)('accepts valid hyphenated hostname: %s', (hostname) => {
        const result = validateHostname(hostname);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(hostname.toLowerCase());
        }
      });
    });

    describe('Platform reserved domain rejection', () => {
      const forbiddenHostnames = [
        { host: 'localhost', reason: 'single-label reserved domain' },
        { host: 'pages.dev', reason: 'Cloudflare pages root' },
        { host: 'portal.pages.dev', reason: 'Cloudflare pages subdomain' },
        { host: 'workers.dev', reason: 'Cloudflare workers root' },
        { host: 'app.workers.dev', reason: 'Cloudflare workers subdomain' },
        { host: 'sophia.agencyos.network', reason: 'platform root domain' },
        { host: 'sub.sophia.agencyos.network', reason: 'platform subdomain' },
        { host: 'agencyos.network', reason: 'platform root' },
        { host: 'admin.agencyos.network', reason: 'platform admin domain' },
      ];

      it.each(forbiddenHostnames)('rejects reserved platform domain: $host ($reason)', ({ host }) => {
        const result = validateHostname(host);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_HOSTNAME');
          expect(result.error.message).toContain('reserved');
        }
      });
    });

    describe('RFC 1035/1123 syntax edge cases', () => {
      it('rejects underscores anywhere in hostname', () => {
        expect(validateHostname('portal_app.example.com').ok).toBe(false);
        expect(validateHostname('portal.example_app.com').ok).toBe(false);
      });

      it('rejects double dots and trailing dots', () => {
        expect(validateHostname('portal..example.com').ok).toBe(false);
        expect(validateHostname('portal.example.com.').ok).toBe(false);
      });

      it('rejects single-character TLDs and numeric TLDs', () => {
        expect(validateHostname('portal.example.c').ok).toBe(false);
        expect(validateHostname('portal.example.123').ok).toBe(false);
      });
    });
  });
});
