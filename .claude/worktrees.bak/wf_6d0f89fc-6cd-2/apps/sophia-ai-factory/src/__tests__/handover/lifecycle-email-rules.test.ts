/**
 * Tests for lifecycle email decision rules.
 * @module __tests__/handover/lifecycle-email-rules.test
 */

import { describe, it, expect } from 'vitest';
import { evaluateLifecycleEmails } from '@/tree/email/lifecycle-email-rules';

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_NOW = Date.now();

function makeHandover(overrides: Partial<Parameters<typeof evaluateLifecycleEmails>[0]> = {}): Parameters<typeof evaluateLifecycleEmails>[0] {
  return {
    createdAt: BASE_NOW - 1 * DAY_MS,
    firstLoginAt: null,
    firstSopInstallAt: null,
    ownerFullName: 'Test',
    locale: 'vi',
    ...overrides,
  };
}

describe('evaluateLifecycleEmails', () => {
  it('D+1: sends nudge if no login', () => {
    const decisions = evaluateLifecycleEmails(makeHandover(), null, BASE_NOW);
    expect(decisions.some(d => d.template === 'onboarding-nudge')).toBe(true);
  });

  it('D+1: skips nudge if user already logged in', () => {
    const decisions = evaluateLifecycleEmails(
      makeHandover({ firstLoginAt: BASE_NOW - 0.5 * DAY_MS }),
      null,
      BASE_NOW,
    );
    expect(decisions.some(d => d.template === 'onboarding-nudge')).toBe(false);
  });

  it('D+7: sends summary if user logged in and has calls', () => {
    const decisions = evaluateLifecycleEmails(
      makeHandover({
        createdAt: BASE_NOW - 7 * DAY_MS,
        firstLoginAt: BASE_NOW - 6 * DAY_MS,
      }),
      { totalCalls: 10, topSop: 'proposal', daysActive: 4 },
      BASE_NOW,
    );
    expect(decisions.some(d => d.template === 'first-week-summary')).toBe(true);
  });

  it('D+7: skips summary if no login', () => {
    const decisions = evaluateLifecycleEmails(
      makeHandover({ createdAt: BASE_NOW - 7 * DAY_MS }),
      { totalCalls: 10, topSop: null, daysActive: 2 },
      BASE_NOW,
    );
    expect(decisions.some(d => d.template === 'first-week-summary')).toBe(false);
  });

  it('D+7: skips summary if 0 API calls', () => {
    const decisions = evaluateLifecycleEmails(
      makeHandover({
        createdAt: BASE_NOW - 7 * DAY_MS,
        firstLoginAt: BASE_NOW - 6 * DAY_MS,
      }),
      { totalCalls: 0, topSop: null, daysActive: 0 },
      BASE_NOW,
    );
    expect(decisions.some(d => d.template === 'first-week-summary')).toBe(false);
  });

  it('returns empty array for user in early D+0 window', () => {
    const decisions = evaluateLifecycleEmails(
      makeHandover({ createdAt: BASE_NOW - 2 * 60 * 60 * 1000 }),
      null,
      BASE_NOW,
    );
    expect(decisions).toHaveLength(0);
  });
});
