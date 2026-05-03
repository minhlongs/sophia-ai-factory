/**
 * Lifecycle email rules — pure function, milestone-gated.
 * @module lib/email/lifecycle-email-rules
 */

import type { WeekStats } from './templates/first-week-summary';

export type LifecycleTemplate = 'onboarding-nudge' | 'first-week-summary';

export interface EmailDecision {
  template: LifecycleTemplate;
  payload: Record<string, unknown>;
}

export interface HandoverMilestones {
  createdAt: number;       // ms
  firstLoginAt: number | null;
  firstSopInstallAt: number | null;
  ownerFullName: string;
  locale: string;
  magicLinkUrl?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Evaluate which lifecycle emails to send for a handover.
 * @param milestones - handover state
 * @param weekStats - only required if D+7 might apply
 * @param now - injectable for testing
 */
export function evaluateLifecycleEmails(
  milestones: HandoverMilestones,
  weekStats: WeekStats | null,
  now: number = Date.now(),
): EmailDecision[] {
  const decisions: EmailDecision[] = [];
  const daysSince = (now - milestones.createdAt) / DAY_MS;

  // D+1: only if no login yet
  if (daysSince >= 0.9 && daysSince < 2.0 && !milestones.firstLoginAt) {
    decisions.push({
      template: 'onboarding-nudge',
      payload: {
        ownerFullName: milestones.ownerFullName,
        locale: milestones.locale,
        magicLinkUrl: milestones.magicLinkUrl ?? '',
      },
    });
  }

  // D+7: only if logged in AND has at least 1 call
  if (daysSince >= 6.9 && daysSince < 8.0 && milestones.firstLoginAt && weekStats && weekStats.totalCalls > 0) {
    decisions.push({
      template: 'first-week-summary',
      payload: {
        ownerFullName: milestones.ownerFullName,
        locale: milestones.locale,
        stats: weekStats,
      },
    });
  }

  return decisions;
}
