/**
 * affiliate-welcome template tests — bilingual rendering + content invariants.
 */

import { describe, it, expect } from 'vitest';
import { renderAffiliateWelcome } from '@/forest/email/templates/affiliate-welcome';

describe('renderAffiliateWelcome', () => {
  const baseInput = {
    ownerFullName: 'Alex Nguyễn',
    referralCode: 'ABC23DEF',
    locale: 'en',
  };

  it('renders English subject + greeting + commission claim', () => {
    const r = renderAffiliateWelcome(baseInput);
    expect(r.subject).toMatch(/welcome.*affiliate/i);
    expect(r.html).toContain('Hello Alex Nguyễn');
    expect(r.html).toMatch(/30%\s+recurring\s+commission/i);
  });

  it('renders Vietnamese variant when locale starts with vi', () => {
    const r = renderAffiliateWelcome({ ...baseInput, locale: 'vi-VN' });
    expect(r.subject).toMatch(/Chào mừng affiliate/);
    expect(r.html).toContain('Xin chào Alex Nguyễn');
    expect(r.html).toMatch(/30%\s+hoa hồng định kỳ/);
  });

  it('embeds the referral code prominently', () => {
    const r = renderAffiliateWelcome(baseInput);
    expect(r.html).toContain('ABC23DEF');
  });

  it('builds a referral link with the encoded code', () => {
    const r = renderAffiliateWelcome({ ...baseInput, referralCode: 'A B+C' });
    expect(r.html).toContain('?ref=A%20B%2BC');
  });

  it('uses locale-correct dashboard URL', () => {
    const en = renderAffiliateWelcome(baseInput);
    const vi = renderAffiliateWelcome({ ...baseInput, locale: 'vi' });
    expect(en.html).toContain('/en/dashboard/affiliate');
    expect(vi.html).toContain('/vi/dashboard/affiliate');
  });

  it('produces non-empty html, text, subject', () => {
    const r = renderAffiliateWelcome(baseInput);
    expect(r.html.length).toBeGreaterThan(200);
    expect(r.text.length).toBeGreaterThan(50);
    expect(r.subject.length).toBeGreaterThan(5);
  });

  it('does NOT leak HTML tags into the text version', () => {
    const r = renderAffiliateWelcome(baseInput);
    expect(r.text).not.toMatch(/<[a-z]+[^>]*>/i);
  });
});
