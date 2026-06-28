/**
 * Tests for lifecycle email rule evaluators (activation reminder + win-back).
 * Existing handover evaluator (`evaluateLifecycleEmails`) is covered by other suites.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateActivationReminderEmails,
  evaluateToolsNudgeEmails,
  evaluateReEngagementD14Emails,
  evaluateWinBackEmails,
  evaluateAffiliateLifecycleEmails,
  type ActivationMilestones,
  type ToolsNudgeMilestones,
  type ReEngagementD14Milestones,
  type WinBackMilestones,
  type AffiliateMilestones,
} from '@/tree/email/lifecycle-email-rules';

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

describe('evaluateToolsNudgeEmails', () => {
  const base: ToolsNudgeMilestones = {
    signupAt: NOW - 4 * DAY,
    firstLoginAt: NOW - 3 * DAY,
    firstVideoCreatedAt: NOW - 2 * DAY,
    ownerFullName: 'Alex',
    locale: 'en',
  };

  it('emits tools-nudge at Day 4 when user shipped first video', () => {
    const decisions = evaluateToolsNudgeEmails(base, NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].template).toBe('tools-nudge');
    expect(decisions[0].payload).toMatchObject({ ownerFullName: 'Alex', locale: 'en' });
  });

  it('skips when user never logged in', () => {
    const m = { ...base, firstLoginAt: null };
    expect(evaluateToolsNudgeEmails(m, NOW)).toHaveLength(0);
  });

  it('skips when user has no first video', () => {
    const m = { ...base, firstVideoCreatedAt: null };
    expect(evaluateToolsNudgeEmails(m, NOW)).toHaveLength(0);
  });

  it('skips before Day 3.9 (too early)', () => {
    const m = { ...base, signupAt: NOW - 3 * DAY };
    expect(evaluateToolsNudgeEmails(m, NOW)).toHaveLength(0);
  });

  it('skips after Day 5 (too late)', () => {
    const m = { ...base, signupAt: NOW - 6 * DAY };
    expect(evaluateToolsNudgeEmails(m, NOW)).toHaveLength(0);
  });

  it('emits VN payload when locale starts with vi', () => {
    const decisions = evaluateToolsNudgeEmails({ ...base, locale: 'vi' }, NOW);
    expect(decisions[0].payload).toMatchObject({ locale: 'vi' });
  });
});

describe('evaluateReEngagementD14Emails', () => {
  const base: ReEngagementD14Milestones = {
    signupAt: NOW - 14 * DAY,
    lastActivityAt: NOW - 8 * DAY,
    subscriptionActive: true,
    ownerFullName: 'Alex',
    locale: 'en',
  };

  it('emits re-engagement at Day 14 when quiet ≥7d and active sub', () => {
    const decisions = evaluateReEngagementD14Emails(base, NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].template).toBe('re-engagement-d14');
    expect(decisions[0].payload).toMatchObject({
      ownerFullName: 'Alex',
      locale: 'en',
      daysSinceLastActivity: 8,
    });
  });

  it('skips if subscription not active', () => {
    const m = { ...base, subscriptionActive: false };
    expect(evaluateReEngagementD14Emails(m, NOW)).toHaveLength(0);
  });

  it('skips if active in last 7 days (quiet < 7d)', () => {
    const m = { ...base, lastActivityAt: NOW - 3 * DAY };
    expect(evaluateReEngagementD14Emails(m, NOW)).toHaveLength(0);
  });

  it('skips before Day 13.9 (too early)', () => {
    const m = { ...base, signupAt: NOW - 13 * DAY };
    expect(evaluateReEngagementD14Emails(m, NOW)).toHaveLength(0);
  });

  it('skips after Day 15 (too late)', () => {
    const m = { ...base, signupAt: NOW - 16 * DAY };
    expect(evaluateReEngagementD14Emails(m, NOW)).toHaveLength(0);
  });

  it('falls back to signupAt when lastActivityAt is null (user never active)', () => {
    const m = { ...base, lastActivityAt: null };
    const decisions = evaluateReEngagementD14Emails(m, NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].payload).toMatchObject({ daysSinceLastActivity: 14 });
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

describe('evaluateAffiliateLifecycleEmails', () => {
  const base: AffiliateMilestones = {
    enrolledAt: NOW - 1 * DAY,
    ownerFullName: 'Alex',
    locale: 'en',
    referralCode: 'ABC23DEF',
  };

  it('emits Day-1 tutorial in [0.9, 2.0) window', () => {
    const decisions = evaluateAffiliateLifecycleEmails(base, NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].template).toBe('affiliate-day1-tutorial');
    expect(decisions[0].payload).toMatchObject({
      ownerFullName: 'Alex',
      locale: 'en',
      referralCode: 'ABC23DEF',
    });
  });

  it('skips Day-1 before window (Day 0.5)', () => {
    const m = { ...base, enrolledAt: NOW - 0.5 * DAY };
    expect(evaluateAffiliateLifecycleEmails(m, NOW)).toHaveLength(0);
  });

  it('emits Day-7 case study at Day 7', () => {
    const m = { ...base, enrolledAt: NOW - 7 * DAY };
    const decisions = evaluateAffiliateLifecycleEmails(m, NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].template).toBe('affiliate-day7-case-study');
  });

  it('Day-7 payload omits stats when not provided', () => {
    const m = { ...base, enrolledAt: NOW - 7 * DAY };
    const [d] = evaluateAffiliateLifecycleEmails(m, NOW);
    expect(d.payload).not.toHaveProperty('stats');
  });

  it('Day-7 payload includes stats when all 3 fields provided', () => {
    const m: AffiliateMilestones = {
      ...base,
      enrolledAt: NOW - 7 * DAY,
      totalClicks: 184,
      totalConversions: 7,
      pendingEarningsUsd: 87,
    };
    const [d] = evaluateAffiliateLifecycleEmails(m, NOW);
    expect(d.payload).toHaveProperty('stats');
    expect(d.payload.stats).toEqual({
      totalClicks: 184,
      totalConversions: 7,
      pendingEarningsUsd: 87,
    });
  });

  it('Day-7 payload omits stats when only partial fields provided', () => {
    const m: AffiliateMilestones = {
      ...base,
      enrolledAt: NOW - 7 * DAY,
      totalClicks: 184,
    };
    const [d] = evaluateAffiliateLifecycleEmails(m, NOW);
    expect(d.payload).not.toHaveProperty('stats');
  });

  it('skips entirely outside both windows (Day 4)', () => {
    const m = { ...base, enrolledAt: NOW - 4 * DAY };
    expect(evaluateAffiliateLifecycleEmails(m, NOW)).toHaveLength(0);
  });

  it('skips after Day 8 (too late)', () => {
    const m = { ...base, enrolledAt: NOW - 9 * DAY };
    expect(evaluateAffiliateLifecycleEmails(m, NOW)).toHaveLength(0);
  });
});
