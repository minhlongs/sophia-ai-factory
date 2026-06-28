/**
 * Tests for bilingual-cta-template (Wave 22 Phase 07).
 */

import { describe, it, expect } from 'vitest';
import { buildBilingualCtaEmail } from '../bilingual-cta-template';

const baseLocale = {
  heading: 'Title',
  paragraphs: ['First.', 'Second.'],
  footer: 'Footer text.',
  ctaLabel: 'Click',
};

describe('buildBilingualCtaEmail', () => {
  it('renders both EN and VI sections with accent color and headings', () => {
    const html = buildBilingualCtaEmail({
      accentColor: '#6750A4',
      en: { ...baseLocale, heading: 'Confirm new email' },
      vi: { ...baseLocale, heading: 'Xác nhận email mới' },
    });
    expect(html).toContain('color:#6750A4');
    expect(html).toContain('<h2 style="color:#6750A4">Confirm new email</h2>');
    expect(html).toContain('<h3 style="color:#6750A4');
    expect(html).toContain('Xác nhận email mới');
    expect(html).toContain('<hr ');
  });

  it('renders CTA button when cta opts provided', () => {
    const html = buildBilingualCtaEmail({
      accentColor: '#dc2626',
      cta: { url: 'https://example.com/confirm', bgColor: '#dc2626' },
      en: { ...baseLocale, ctaLabel: 'Confirm deletion' },
      vi: { ...baseLocale, ctaLabel: 'Xác nhận xoá' },
    });
    expect(html).toContain('<a href="https://example.com/confirm"');
    expect(html).toContain('background:#dc2626');
    expect(html).toContain('Confirm deletion · Xác nhận xoá');
  });

  it('omits CTA when cta opt missing', () => {
    const html = buildBilingualCtaEmail({
      accentColor: '#10b981',
      en: baseLocale,
      vi: baseLocale,
    });
    expect(html).not.toContain('<a href');
  });

  it('throws on non-https / non-localhost CTA URL', () => {
    expect(() =>
      buildBilingualCtaEmail({
        accentColor: '#dc2626',
        cta: { url: 'javascript:alert(1)', bgColor: '#dc2626' },
        en: baseLocale,
        vi: baseLocale,
      }),
    ).toThrow(/Invalid CTA URL/);
  });

  it('escapes HTML in headings, paragraphs, and footer', () => {
    const html = buildBilingualCtaEmail({
      accentColor: '#000',
      en: {
        heading: '<script>alert(1)</script>',
        paragraphs: ['email <evil@x>'],
        footer: '& <b>',
      },
      vi: baseLocale,
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('email &lt;evil@x&gt;');
    expect(html).toContain('&amp; &lt;b&gt;');
  });

  it('renders multiple paragraphs as separate <p> tags', () => {
    const html = buildBilingualCtaEmail({
      accentColor: '#000',
      en: { ...baseLocale, paragraphs: ['One.', 'Two.', 'Three.'] },
      vi: baseLocale,
    });
    const enParaCount = (html.match(/<p>(One|Two|Three)\.<\/p>/g) ?? []).length;
    expect(enParaCount).toBe(3);
  });

  it('accepts http://localhost URLs (dev environment)', () => {
    expect(() =>
      buildBilingualCtaEmail({
        accentColor: '#000',
        cta: { url: 'http://localhost:3000/confirm', bgColor: '#000' },
        en: baseLocale,
        vi: baseLocale,
      }),
    ).not.toThrow();
  });
});
