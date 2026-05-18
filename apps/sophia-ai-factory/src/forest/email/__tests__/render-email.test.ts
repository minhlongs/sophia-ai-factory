/**
 * renderEmail dispatcher — every TemplateKey resolves to a renderer that
 * produces non-empty html/text/subject. Smoke-level so we catch the regression
 * where a new template is added but never wired into the switch.
 */

import { describe, it, expect } from 'vitest';
import { renderEmail, type TemplateKey, type TemplateDataMap } from '../render-email';

const fixtures: { [K in TemplateKey]: TemplateDataMap[K] } = {
  'welcome-magic-link': {
    ownerFullName: 'Mai',
    tier: 'BASIC',
    magicLinkUrl: 'https://example.com/magic',
    locale: 'en',
  },
  'onboarding-nudge': {
    ownerFullName: 'Mai',
    locale: 'en',
    magicLinkUrl: 'https://example.com/magic',
  },
  'first-week-summary': {
    ownerFullName: 'Mai',
    locale: 'en',
    stats: {
      totalCalls: 5,
      topSop: 'Sophia onboarding',
      daysActive: 4,
    },
  },
  'tier-upgrade': {
    ownerFullName: 'Mai',
    locale: 'en',
    newTier: 'PREMIUM',
  },
  'activation-reminder': {
    ownerFullName: 'Mai',
    locale: 'en',
    daysSinceSignup: 3,
  },
  'setup-complete': {
    ownerFullName: 'Mai',
    locale: 'en',
  },
  'tools-nudge': {
    ownerFullName: 'Mai',
    locale: 'en',
  },
  're-engagement-d14': {
    ownerFullName: 'Mai',
    locale: 'en',
    daysSinceLastActivity: 8,
  },
  'win-back': {
    ownerFullName: 'Mai',
    locale: 'en',
    cancelledAt: '2026-03-01',
    discountCode: 'COMEBACK20',
    discountPercent: 20,
  },
  'affiliate-welcome': {
    ownerFullName: 'Mai',
    referralCode: 'ABC123',
    locale: 'en',
  },
  'affiliate-day1-tutorial': {
    ownerFullName: 'Mai',
    referralCode: 'ABC123',
    locale: 'en',
  },
  'affiliate-day7-case-study': {
    ownerFullName: 'Mai',
    locale: 'en',
    stats: {
      totalClicks: 120,
      totalConversions: 4,
      pendingEarningsUsd: 87.5,
    },
  },
};

const ALL_KEYS: TemplateKey[] = [
  'welcome-magic-link',
  'onboarding-nudge',
  'first-week-summary',
  'tier-upgrade',
  'activation-reminder',
  'setup-complete',
  'tools-nudge',
  're-engagement-d14',
  'win-back',
  'affiliate-welcome',
  'affiliate-day1-tutorial',
  'affiliate-day7-case-study',
];

describe('renderEmail dispatcher', () => {
  it.each(ALL_KEYS)('renders %s with non-empty html/text/subject', (key) => {
    const result = renderEmail(key, fixtures[key]);
    expect(result.html.length).toBeGreaterThan(20);
    expect(result.text.length).toBeGreaterThan(10);
    expect(result.subject.length).toBeGreaterThan(0);
  });

  it('throws on unknown template', () => {
    expect(() =>
      renderEmail('not-a-real-template' as TemplateKey, {} as never),
    ).toThrow(/Unknown email template/);
  });
});
