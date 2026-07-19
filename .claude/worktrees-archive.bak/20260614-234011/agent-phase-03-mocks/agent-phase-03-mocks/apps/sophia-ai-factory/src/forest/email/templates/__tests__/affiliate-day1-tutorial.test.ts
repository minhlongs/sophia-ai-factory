/**
 * affiliate-day1-tutorial template tests — bilingual rendering + content invariants.
 */

import { describe, it, expect } from 'vitest';
import { renderAffiliateDay1Tutorial } from '@/forest/email/templates/affiliate-day1-tutorial';

describe('renderAffiliateDay1Tutorial', () => {
  const baseInput = {
    ownerFullName: 'Alex Nguyễn',
    referralCode: 'ABC23DEF',
    locale: 'en',
  };

  it('renders English subject + greeting + 3-step playbook', () => {
    const r = renderAffiliateDay1Tutorial(baseInput);
    expect(r.subject).toMatch(/deploy.*affiliate/i);
    expect(r.html).toContain('Hello Alex Nguyễn');
    expect(r.html).toMatch(/Step\s*1/);
    expect(r.html).toMatch(/Step\s*2/);
    expect(r.html).toMatch(/Step\s*3/);
  });

  it('renders Vietnamese variant when locale starts with vi', () => {
    const r = renderAffiliateDay1Tutorial({ ...baseInput, locale: 'vi-VN' });
    expect(r.subject).toMatch(/deploy.*affiliate/i);
    expect(r.html).toContain('Xin chào Alex Nguyễn');
    expect(r.html).toMatch(/Bước\s*1/);
    expect(r.html).toMatch(/Bước\s*3/);
  });

  it('embeds the referral link with encoded code in the copy template', () => {
    const r = renderAffiliateDay1Tutorial({ ...baseInput, referralCode: 'A B+C' });
    expect(r.html).toContain('?ref=A%20B%2BC');
  });

  it('uses locale-correct dashboard URL', () => {
    const en = renderAffiliateDay1Tutorial(baseInput);
    const vi = renderAffiliateDay1Tutorial({ ...baseInput, locale: 'vi' });
    expect(en.html).toContain('/en/dashboard/affiliate');
    expect(vi.html).toContain('/vi/dashboard/affiliate');
  });

  it('produces non-empty html, text, subject', () => {
    const r = renderAffiliateDay1Tutorial(baseInput);
    expect(r.html.length).toBeGreaterThan(300);
    expect(r.text.length).toBeGreaterThan(100);
    expect(r.subject.length).toBeGreaterThan(5);
  });

  it('does NOT leak HTML tags into the text version', () => {
    const r = renderAffiliateDay1Tutorial(baseInput);
    expect(r.text).not.toMatch(/<[a-z]+[^>]*>/i);
  });

  it('lists at least 4 niche segments', () => {
    const r = renderAffiliateDay1Tutorial(baseInput);
    const niches = (r.html.match(/<li>/g) ?? []).length;
    expect(niches).toBeGreaterThanOrEqual(4);
  });
});
