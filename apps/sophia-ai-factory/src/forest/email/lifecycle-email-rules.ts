/**
 * Lifecycle email rules — pure function, milestone-gated.
 *
 * Three independent evaluators (handover-style, activation, win-back) all return
 * EmailDecision[] consumed by the same email-drip cron. Keep them separate so
 * each milestone schema stays narrow.
 *
 * @module lib/email/lifecycle-email-rules
 */

import type { WeekStats } from './templates/first-week-summary';

export type LifecycleTemplate =
  | 'onboarding-nudge'
  | 'first-week-summary'
  | 'activation-reminder'
  | 'win-back';

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

// ─── Activation Reminder (Day 3) ────────────────────────────────────────────

export interface ActivationMilestones {
  signupAt: number;             // ms
  firstLoginAt: number | null;
  firstVideoCreatedAt: number | null;
  ownerFullName: string;
  locale: string;
}

/**
 * Day-3 activation reminder.
 * Sent only if: user logged in AND never created a first video.
 * Distinct from `onboarding-nudge` (D+1) which targets users who haven't logged in at all.
 */
export function evaluateActivationReminderEmails(
  milestones: ActivationMilestones,
  now: number = Date.now(),
): EmailDecision[] {
  const decisions: EmailDecision[] = [];
  const daysSince = (now - milestones.signupAt) / DAY_MS;

  if (
    daysSince >= 2.9 &&
    daysSince < 4.0 &&
    milestones.firstLoginAt &&
    !milestones.firstVideoCreatedAt
  ) {
    decisions.push({
      template: 'activation-reminder',
      payload: {
        ownerFullName: milestones.ownerFullName,
        locale: milestones.locale,
        daysSinceSignup: Math.floor(daysSince),
      },
    });
  }

  return decisions;
}

// ─── Win-Back (Day 60 churned) ──────────────────────────────────────────────

export interface WinBackMilestones {
  cancelledAt: number;          // ms — when subscription was cancelled
  cancelledAtIso: string;       // ISO date string for copy ("since {date}")
  reactivatedAt: number | null; // null if user has not returned
  ownerFullName: string;
  locale: string;
  /** Optional discount code to embed in the email. */
  discountCode?: string;
  discountPercent?: number;
}

/**
 * Day-60 win-back nudge.
 * Sent once: only if user has NOT reactivated within 60 days of cancellation.
 * If user is already back (reactivatedAt set), skip.
 */
export function evaluateWinBackEmails(
  milestones: WinBackMilestones,
  now: number = Date.now(),
): EmailDecision[] {
  const decisions: EmailDecision[] = [];
  if (milestones.reactivatedAt) return decisions;

  const daysSince = (now - milestones.cancelledAt) / DAY_MS;
  if (daysSince >= 59.5 && daysSince < 61.0) {
    decisions.push({
      template: 'win-back',
      payload: {
        ownerFullName: milestones.ownerFullName,
        locale: milestones.locale,
        cancelledAt: milestones.cancelledAtIso,
        discountCode: milestones.discountCode,
        discountPercent: milestones.discountPercent,
      },
    });
  }

  return decisions;
}
