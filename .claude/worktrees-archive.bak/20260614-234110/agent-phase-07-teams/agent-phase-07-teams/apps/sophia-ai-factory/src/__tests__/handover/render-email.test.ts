/**
 * Tests for unified renderEmail registry — all templates × 2 locales.
 * @module __tests__/handover/render-email.test
 */

import { describe, it, expect } from 'vitest';
import { renderEmail } from '@/forest/email/render-email';

describe('renderEmail', () => {
  it('welcome-magic-link vi: returns html, text, subject', () => {
    const result = renderEmail('welcome-magic-link', {
      ownerFullName: 'Nguyen Van A',
      tier: 'BASIC',
      magicLinkUrl: 'https://sophia.agencyos.network/vi/welcome/token123',
      locale: 'vi',
    });
    expect(result.html).toContain('Sophia AI Factory');
    expect(result.html).toContain('Nguyen Van A');
    expect(result.subject).toContain('BASIC');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('welcome-magic-link en: returns English subject', () => {
    const result = renderEmail('welcome-magic-link', {
      ownerFullName: 'John Doe',
      tier: 'PREMIUM',
      magicLinkUrl: 'https://example.com/welcome/abc',
      locale: 'en',
    });
    expect(result.subject).toContain('ready');
    expect(result.html).toContain('John Doe');
  });

  it('onboarding-nudge vi: renders', () => {
    const result = renderEmail('onboarding-nudge', {
      ownerFullName: 'Test User',
      magicLinkUrl: 'https://example.com/welcome/xyz',
      locale: 'vi',
    });
    expect(result.html).toContain('Sophia AI Factory');
    expect(result.subject).toBeTruthy();
  });

  it('onboarding-nudge en: renders', () => {
    const result = renderEmail('onboarding-nudge', {
      ownerFullName: 'Test User',
      magicLinkUrl: 'https://example.com/welcome/xyz',
      locale: 'en',
    });
    expect(result.subject).toContain('waiting');
  });

  it('first-week-summary vi: includes stats', () => {
    const result = renderEmail('first-week-summary', {
      ownerFullName: 'Test',
      locale: 'vi',
      stats: { totalCalls: 42, topSop: 'proposal-auto-pilot', daysActive: 5 },
    });
    expect(result.html).toContain('42');
    expect(result.html).toContain('proposal-auto-pilot');
  });

  it('first-week-summary en: renders without topSop', () => {
    const result = renderEmail('first-week-summary', {
      ownerFullName: 'Test',
      locale: 'en',
      stats: { totalCalls: 3, topSop: null, daysActive: 2 },
    });
    expect(result.html).toContain('first week');
  });

  it('tier-upgrade vi: includes tier name', () => {
    const result = renderEmail('tier-upgrade', {
      ownerFullName: 'User',
      newTier: 'ENTERPRISE',
      locale: 'vi',
    });
    expect(result.html).toContain('ENTERPRISE');
  });

  it('tier-upgrade en: renders', () => {
    const result = renderEmail('tier-upgrade', {
      ownerFullName: 'User',
      newTier: 'MASTER',
      locale: 'en',
    });
    expect(result.subject).toContain('MASTER');
  });
});
