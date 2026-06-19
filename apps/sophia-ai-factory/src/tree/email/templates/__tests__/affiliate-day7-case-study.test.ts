/**
 * affiliate-day7-case-study template tests — bilingual + optional stats personalization.
 */

import { describe, it, expect } from 'vitest';
import { renderAffiliateDay7CaseStudy } from '@/tree/email/templates/affiliate-day7-case-study';

describe('renderAffiliateDay7CaseStudy', () => {
  const baseInput = {
    ownerFullName: 'Alex',
    locale: 'en',
  };

  it('renders English case study with Mai T. social proof', () => {
    const r = renderAffiliateDay7CaseStudy(baseInput);
    expect(r.subject).toMatch(/week\s*1/i);
    expect(r.html).toContain('Hello Alex');
    expect(r.html).toMatch(/Mai T\./);
    expect(r.html).toMatch(/\$512/);
  });

  it('renders Vietnamese variant', () => {
    const r = renderAffiliateDay7CaseStudy({ ...baseInput, locale: 'vi' });
    expect(r.html).toContain('Xin chào Alex');
    expect(r.html).toMatch(/Tuần đầu|Tuần 1/);
  });

  it('shows benchmark block in both locales', () => {
    const en = renderAffiliateDay7CaseStudy(baseInput);
    const vi = renderAffiliateDay7CaseStudy({ ...baseInput, locale: 'vi' });
    expect(en.html).toMatch(/benchmark/i);
    expect(vi.html).toMatch(/Benchmark|benchmark/);
  });

  it('omits "your week 1" block when stats are not provided', () => {
    const r = renderAffiliateDay7CaseStudy(baseInput);
    expect(r.html).not.toMatch(/Your week 1/i);
    expect(r.html).not.toMatch(/Tuần 1 của bạn/);
  });

  it('renders personalized "your week 1" block when stats provided', () => {
    const r = renderAffiliateDay7CaseStudy({
      ...baseInput,
      stats: { totalClicks: 184, totalConversions: 7, pendingEarningsUsd: 87 },
    });
    expect(r.html).toMatch(/Your week 1/);
    expect(r.html).toContain('184');
    expect(r.html).toContain('$87.00');
  });

  it('formats earnings to 2 decimal places', () => {
    const r = renderAffiliateDay7CaseStudy({
      ...baseInput,
      stats: { totalClicks: 1, totalConversions: 1, pendingEarningsUsd: 12.5 },
    });
    expect(r.html).toContain('$12.50');
  });

  it('uses locale-correct dashboard URL', () => {
    const en = renderAffiliateDay7CaseStudy(baseInput);
    const vi = renderAffiliateDay7CaseStudy({ ...baseInput, locale: 'vi' });
    expect(en.html).toContain('/en/dashboard/affiliate');
    expect(vi.html).toContain('/vi/dashboard/affiliate');
  });

  it('produces non-empty html, text, subject', () => {
    const r = renderAffiliateDay7CaseStudy(baseInput);
    expect(r.html.length).toBeGreaterThan(300);
    expect(r.text.length).toBeGreaterThan(100);
    expect(r.subject.length).toBeGreaterThan(5);
  });

  it('does NOT leak HTML tags into the text version', () => {
    const r = renderAffiliateDay7CaseStudy({
      ...baseInput,
      stats: { totalClicks: 50, totalConversions: 2, pendingEarningsUsd: 24 },
    });
    expect(r.text).not.toMatch(/<[a-z]+[^>]*>/i);
  });
});
