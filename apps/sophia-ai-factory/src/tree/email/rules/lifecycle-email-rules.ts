/**
 * Core lifecycle email rules engine: handover and affiliate lifecycle evaluation.
 *
 * @module tree/email/rules/lifecycle-email-rules
 */

import type { WeekStats } from '../templates/first-week-summary';
import {
  DAY_MS,
  type EmailDecision,
  type HandoverMilestones,
  type AffiliateMilestones,
} from './types';

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

/**
 * Affiliate Day-1 first-link tutorial + Day-7 case study.
 * No engagement gating beyond the time window — every enrolled affiliate gets both.
 */
export function evaluateAffiliateLifecycleEmails(
  milestones: AffiliateMilestones,
  now: number = Date.now(),
): EmailDecision[] {
  const decisions: EmailDecision[] = [];
  const daysSince = (now - milestones.enrolledAt) / DAY_MS;

  if (daysSince >= 0.9 && daysSince < 2.0) {
    decisions.push({
      template: 'affiliate-day1-tutorial',
      payload: {
        ownerFullName: milestones.ownerFullName,
        locale: milestones.locale,
        referralCode: milestones.referralCode,
      },
    });
  }

  if (daysSince >= 6.9 && daysSince < 8.0) {
    const payload: Record<string, unknown> = {
      ownerFullName: milestones.ownerFullName,
      locale: milestones.locale,
    };
    if (
      typeof milestones.totalClicks === 'number' &&
      typeof milestones.totalConversions === 'number' &&
      typeof milestones.pendingEarningsUsd === 'number'
    ) {
      payload.stats = {
        totalClicks: milestones.totalClicks,
        totalConversions: milestones.totalConversions,
        pendingEarningsUsd: milestones.pendingEarningsUsd,
      };
    }
    decisions.push({ template: 'affiliate-day7-case-study', payload });
  }

  return decisions;
}
