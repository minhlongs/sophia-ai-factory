/**
 * User milestones evaluator for activation reminders, tools nudges,
 * re-engagement, and win-back emails.
 *
 * @module tree/email/rules/trigger-evaluator
 */

import {
  DAY_MS,
  type EmailDecision,
  type ActivationMilestones,
  type ToolsNudgeMilestones,
  type ReEngagementD14Milestones,
  type WinBackMilestones,
} from './types';

/**
 * Day-3 activation reminder.
 * Sent only if: user logged in AND never created a first video.
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

/**
 * Day-4 tools-nudge: highlight 3 power features for users who already shipped
 * their first video. Gates: signup >= 3.9d ago AND firstLogin AND firstVideo.
 */
export function evaluateToolsNudgeEmails(
  milestones: ToolsNudgeMilestones,
  now: number = Date.now(),
): EmailDecision[] {
  const decisions: EmailDecision[] = [];
  const daysSince = (now - milestones.signupAt) / DAY_MS;

  if (
    daysSince >= 3.9 &&
    daysSince < 5.0 &&
    milestones.firstLoginAt &&
    milestones.firstVideoCreatedAt
  ) {
    decisions.push({
      template: 'tools-nudge',
      payload: {
        ownerFullName: milestones.ownerFullName,
        locale: milestones.locale,
      },
    });
  }

  return decisions;
}

/**
 * Day-14 re-engagement: still-paying users who went quiet for 7+ days.
 * Gates: signup >= 13.9d ago AND subscription still active AND no activity for >= 7d.
 */
export function evaluateReEngagementD14Emails(
  milestones: ReEngagementD14Milestones,
  now: number = Date.now(),
): EmailDecision[] {
  const decisions: EmailDecision[] = [];
  if (!milestones.subscriptionActive) return decisions;

  const daysSinceSignup = (now - milestones.signupAt) / DAY_MS;
  if (daysSinceSignup < 13.9 || daysSinceSignup >= 15.0) return decisions;

  const lastActivity = milestones.lastActivityAt ?? milestones.signupAt;
  const daysSinceActivity = (now - lastActivity) / DAY_MS;
  if (daysSinceActivity < 7) return decisions;

  decisions.push({
    template: 're-engagement-d14',
    payload: {
      ownerFullName: milestones.ownerFullName,
      locale: milestones.locale,
      daysSinceLastActivity: Math.floor(daysSinceActivity),
    },
  });

  return decisions;
}

/**
 * Day-60 win-back nudge.
 * Sent once: only if user has NOT reactivated within 60 days of cancellation.
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
