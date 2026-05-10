/**
 * Tests for lifecycle email rule evaluators (activation reminder + win-back).
 * Existing handover evaluator (`evaluateLifecycleEmails`) is covered by other suites.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateActivationReminderEmails,
  evaluateWinBackEmails,
  type ActivationMilestones,
  type WinBackMilestones,
} from '@/forest/email/lifecycle-email-rules';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('evaluateActivationReminderEmails', () => {
  const base: ActivationMilestones = {
    signupAt: NOW - 3 * DAY,
    firstLoginAt: NOW - 2 * DAY,
    firstVideoCreatedAt: null,
    ownerFullName: 'Alex',
    locale: 'en',
  };

  it('emits reminder on Day 3 when logged in but no video', () => {
    const decisions = evaluateActivationReminderEmails(base, NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].template).toBe('activation-reminder');
    expect(decisions[0].payload).toMatchObject({ ownerFullName: 'Alex', locale: 'en' });
  });

  it('skips when user never logged in', () => {
    const m = { ...base, firstLoginAt: null };
    expect(evaluateActivationReminderEmails(m, NOW)).toHaveLength(0);
  });

  it('skips when user already created a video', () => {
    const m = { ...base, firstVideoCreatedAt: NOW - 1 * DAY };
    expect(evaluateActivationReminderEmails(m, NOW)).toHaveLength(0);
  });

  it('skips before Day 2.9 (too early)', () => {
    const m: ActivationMilestones = {
      ...base,
      signupAt: NOW - 2 * DAY,
    };
    expect(evaluateActivationReminderEmails(m, NOW)).toHaveLength(0);
  });

  it('skips after Day 4 (too late)', () => {
    const m: ActivationMilestones = {
      ...base,
      signupAt: NOW - 5 * DAY,
    };
    expect(evaluateActivationReminderEmails(m, NOW)).toHaveLength(0);
  });
});

describe('evaluateWinBackEmails', () => {
  const base: WinBackMilestones = {
    cancelledAt: NOW - 60 * DAY,
    cancelledAtIso: '2026-03-10',
    reactivatedAt: null,
    ownerFullName: 'Alex',
    locale: 'en',
  };

  it('emits win-back at Day 60 when not reactivated', () => {
    const decisions = evaluateWinBackEmails(base, NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].template).toBe('win-back');
    expect(decisions[0].payload).toMatchObject({
      ownerFullName: 'Alex',
      cancelledAt: '2026-03-10',
    });
  });

  it('skips if user already reactivated', () => {
    const m = { ...base, reactivatedAt: NOW - 30 * DAY };
    expect(evaluateWinBackEmails(m, NOW)).toHaveLength(0);
  });

  it('skips before Day 59.5 (too early)', () => {
    const m = { ...base, cancelledAt: NOW - 50 * DAY };
    expect(evaluateWinBackEmails(m, NOW)).toHaveLength(0);
  });

  it('skips after Day 61 (too late)', () => {
    const m = { ...base, cancelledAt: NOW - 70 * DAY };
    expect(evaluateWinBackEmails(m, NOW)).toHaveLength(0);
  });

  it('passes through optional discount fields to payload', () => {
    const decisions = evaluateWinBackEmails(
      { ...base, discountCode: 'BACK30', discountPercent: 30 },
      NOW,
    );
    expect(decisions[0].payload).toMatchObject({ discountCode: 'BACK30', discountPercent: 30 });
  });
});
