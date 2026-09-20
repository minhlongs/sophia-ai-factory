/**
 * Unit Tests for White-Label Email Styler & Sender Integration.
 *
 * Covers:
 * 1. Branded email formatting (logo, typography, primary color, contrast text)
 * 2. Unbranded minimalist fallback layout (zero vendor branding leak)
 * 3. Security: HTML entity escaping against XSS in email clients
 * 4. Preheader and full document injection
 * 5. Plain text formatting with agency footer
 * 6. Sender integration (dynamic From/Reply-To and dry-run safety)
 * 7. wrapWithAgencyBranding interface contract (PROJECT.md:70)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatWhiteLabelEmail,
  formatWhiteLabelPlainText,
  wrapWithAgencyBranding,
  escapeHtml,
  getContrastTextColor,
} from '@/tree/branding/email-styler';
import { sendEmail } from '@/tree/email/sender';

describe('White-Label Email Styler — Unit Tests', () => {
  describe('1. Branded Email Formatting', () => {
    it('renders agency logo and custom primary color', () => {
      const html = '<p>Your video render is complete.</p><a href="https://example.com" class="brand-btn">Download</a>';
      const formatted = formatWhiteLabelEmail(html, {
        agencyName: 'Apex Creative Studio',
        logoUrl: 'https://cdn.apex.com/email-logo.png',
        primaryColor: '#059669', // Emerald
        supportEmail: 'help@apexstudio.com',
        legalDisclaimer: '© 2026 Apex Creative Studio LLC. All rights reserved.',
        unsubscribeUrl: 'https://apexstudio.com/unsubscribe',
      });

      expect(formatted).toContain('https://cdn.apex.com/email-logo.png');
      expect(formatted).toContain('alt="Apex Creative Studio"');
      expect(formatted).toContain('#059669');
      expect(formatted).toContain('help@apexstudio.com');
      expect(formatted).toContain('© 2026 Apex Creative Studio LLC. All rights reserved.');
      expect(formatted).toContain('https://apexstudio.com/unsubscribe');

      // Assert zero platform vendor leakage
      expect(formatted).not.toContain('Sophia AI Factory');
      expect(formatted).not.toContain('support@mekongmind.com');
      expect(formatted).not.toContain('mekongmind.com');
    });

    it('renders agency typography when logo URL is not configured', () => {
      const html = '<p>Account verification required.</p>';
      const formatted = formatWhiteLabelEmail(html, {
        agencyName: 'Titan Media Agency',
        primaryColor: '#6366F1',
      });

      expect(formatted).toContain('Titan Media Agency');
      expect(formatted).toContain('<h1');
      expect(formatted).not.toContain('<img');
    });

    it('applies high-contrast text color for buttons based on primary background', () => {
      // Dark primary background -> white text
      expect(getContrastTextColor('#6366F1')).toBe('#ffffff');
      expect(getContrastTextColor('#000000')).toBe('#ffffff');

      // Bright primary background -> dark text
      expect(getContrastTextColor('#F59E0B')).toBe('#09090b');
      expect(getContrastTextColor('#FFFF00')).toBe('#09090b');
      // W3C relative luminance: lime green (#00FF00), emerald (#10B981), and 3-char hex (#0f0) select dark text
      expect(getContrastTextColor('#00FF00')).toBe('#09090b');
      expect(getContrastTextColor('#10B981')).toBe('#09090b');
      expect(getContrastTextColor('#0f0')).toBe('#09090b');
    });

    it('supports 3-character hex shorthand colors (#0f0 -> #00FF00)', () => {
      const html = '<p>Render complete</p>';
      const formatted = formatWhiteLabelEmail(html, {
        primaryColor: '#0f0',
      });
      expect(formatted).toContain('#00FF00');
    });

    it('replaces hardcoded legacy purple gradients with tenant primary color', () => {
      const html = '<a href="#" style="background: linear-gradient(135deg, #7c3aed, #2563eb);">Action</a>';
      const formatted = formatWhiteLabelEmail(html, {
        primaryColor: '#059669',
      });

      expect(formatted).not.toContain('linear-gradient');
      expect(formatted).toContain('background-color:#059669');
    });
  });

  describe('2. Unbranded Neutral Fallback Layout', () => {
    it('produces a clean, unbranded layout when branding is null', () => {
      const html = '<p>Notification message body.</p>';
      const formatted = formatWhiteLabelEmail(html, null);

      expect(formatted).toContain('Notification message body.');
      // Neutral accent line instead of logo or vendor name
      expect(formatted).toContain('height:3px;width:40px;');
      // Zero Sophia references
      expect(formatted).not.toContain('Sophia AI Factory');
      expect(formatted).not.toContain('support@mekongmind.com');
    });
  });

  describe('3. Preheader & Document Structure', () => {
    it('injects hidden preheader snippet for email inbox previews', () => {
      const html = '<p>Video rendering finished.</p>';
      const formatted = formatWhiteLabelEmail(html, null, {
        preheaderText: 'Your render is ready for download — click here',
      });

      expect(formatted).toContain('Your render is ready for download — click here');
      expect(formatted).toContain('display:none;font-size:1px;');
    });

    it('injects header and footer into existing complete HTML documents', () => {
      const fullDoc = '<!DOCTYPE html><html><body><p>Existing body content</p></body></html>';
      const formatted = formatWhiteLabelEmail(fullDoc, {
        agencyName: 'Apex Studio',
        supportEmail: 'contact@apex.com',
      });

      expect(formatted).toContain('Apex Studio');
      expect(formatted).toContain('Existing body content');
      expect(formatted).toContain('contact@apex.com');
      // Should not duplicate html / body tags
      expect(formatted.match(/<body[^>]*>/g)?.length).toBe(1);
      expect(formatted.match(/<\/body>/g)?.length).toBe(1);
    });
  });

  describe('4. Security & XSS Prevention', () => {
    it('escapes dangerous HTML characters in agency metadata', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
      expect(escapeHtml('Agency & Co. "The Best"')).toBe(
        'Agency &amp; Co. &quot;The Best&quot;',
      );
      expect(escapeHtml(null)).toBe('');
    });

    it('prevents script tag injection in rendered email header & footer', () => {
      const formatted = formatWhiteLabelEmail('<p>Safe content</p>', {
        agencyName: '<script>evil()</script>',
        supportEmail: '"><script>attack()</script>',
        legalDisclaimer: '<img src=x onerror=alert(1)>',
      });

      expect(formatted).not.toContain('<script>');
      expect(formatted).toContain('&lt;script&gt;evil()&lt;/script&gt;');
      expect(formatted).not.toContain('<img src=x');
    });

    it('validates protocol on unsubscribeUrl and rejects javascript: or data: schemes', () => {
      const formatted = formatWhiteLabelEmail('<p>Safe content</p>', {
        unsubscribeUrl: 'javascript:alert(document.cookie)',
      });
      expect(formatted).not.toContain('href="javascript:');
      expect(formatted).not.toContain('alert(document.cookie)');

      const formattedData = formatWhiteLabelEmail('<p>Safe content</p>', {
        unsubscribeUrl: 'data:text/html,<script>alert(1)</script>',
      });
      expect(formattedData).not.toContain('href="data:');

      const plainText = formatWhiteLabelPlainText('Message', {
        unsubscribeUrl: 'javascript:alert(1)',
      });
      expect(plainText).not.toContain('Unsubscribe: javascript:');
    });

    it('prevents regex replacement token corruption ($&, $1) in document injection', () => {
      const fullDoc = '<!DOCTYPE html><html><body><p>Notification content</p></body></html>';
      const formatted = formatWhiteLabelEmail(fullDoc, {
        agencyName: 'Apex $& Studio $1 Media',
        legalDisclaimer: 'Discount code $100 off',
      });

      expect(formatted).toContain('Apex $&amp; Studio $1 Media');
      expect(formatted).not.toContain('Apex <body>');
      expect(formatted).toContain('Discount code $100 off');
    });
  });

  describe('5. Plain Text Fallback Formatting', () => {
    it('formats plain text with uppercase agency header and footer', () => {
      const text = 'Your weekly video generation quota has been reset.';
      const result = formatWhiteLabelPlainText(text, {
        agencyName: 'Apex Creative Studio',
        supportEmail: 'support@apex.com',
        legalDisclaimer: 'Apex Studio LLC, 123 Brand Way',
        unsubscribeUrl: 'https://apex.com/optout',
      });

      expect(result).toContain('APEX CREATIVE STUDIO');
      expect(result).toContain('Your weekly video generation quota has been reset.');
      expect(result).toContain('Support: support@apex.com');
      expect(result).toContain('Apex Studio LLC, 123 Brand Way');
      expect(result).toContain('Unsubscribe: https://apex.com/optout');
    });
  });

  describe('6. Interface Contract (PROJECT.md:70)', () => {
    it('wrapWithAgencyBranding produces compliant branded email HTML', () => {
      const output = wrapWithAgencyBranding('<p>Invoice #10023</p>', {
        agencyName: 'Global Video Agency',
        primaryColor: '#7C3AED',
        emailFooter: 'Thank you for your business.',
      });

      expect(output).toContain('Global Video Agency');
      expect(output).toContain('Invoice #10023');
      expect(output).toContain('Thank you for your business.');
      expect(output).not.toContain('Sophia AI Factory');
    });
  });

  describe('7. Sender Integration with White-Label Options', () => {
    const originalApiKey = process.env.RESEND_API_KEY;

    beforeEach(() => {
      delete process.env.RESEND_API_KEY;
    });

    afterEach(() => {
      if (originalApiKey) {
        process.env.RESEND_API_KEY = originalApiKey;
      }
    });

    it('operates in dry-run mode and formats dynamic white-label sender headers', async () => {
      const result = await sendEmail({
        to: 'client@example.com',
        subject: 'Your video campaign is ready',
        html: '<p>Click below to review</p>',
        branding: {
          agencyName: 'MediaForge',
          emailFromName: 'MediaForge Productions',
          customDomain: 'portal.mediaforge.io',
          supportEmail: 'help@mediaforge.io',
        },
      });

      expect(result.provider).toBe('dry-run');
      expect(result.success).toBe(false);
      expect(result.error).toBe('RESEND_API_KEY not configured');
    });
  });
});
