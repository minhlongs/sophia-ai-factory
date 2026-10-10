/**
 * Email cadence, throttling, and post-purchase lifecycle rules.
 *
 * @module tree/email/rules/cadence-throttler
 */

import type {
  EmailDecision,
  PostPurchaseWelcomeMilestones,
  PostPurchaseNudgeMilestones,
  PostPurchaseFirstSuccessMilestones,
} from './types';

/**
 * Immediate post-purchase welcome.
 * Sent once, right after payment_confirmed — gates: purchasedAt within last 30 min.
 * Window: 0-30 min after purchase.
 */
export function evaluatePostPurchaseWelcomeEmails(
  milestones: PostPurchaseWelcomeMilestones,
  now: number = Date.now(),
): EmailDecision[] {
  const decisions: EmailDecision[] = [];
  const minsSince = (now - milestones.purchasedAt) / (60 * 1000);

  if (minsSince >= 0 && minsSince < 30) {
    decisions.push({
      template: 'post-purchase-welcome',
      payload: {
        ownerFullName: milestones.ownerFullName,
        tier: milestones.tier,
        locale: milestones.locale,
      },
    });
  }

  return decisions;
}

/**
 * Activation nudge: 2h after purchase, only if setup wizard not yet completed.
 * Window: 1.9–3.0 hours after purchase.
 */
export function evaluatePostPurchaseNudgeEmails(
  milestones: PostPurchaseNudgeMilestones,
  now: number = Date.now(),
): EmailDecision[] {
  const decisions: EmailDecision[] = [];
  if (milestones.onboardingCompletedAt) return decisions;

  const hoursSince = (now - milestones.purchasedAt) / (3600 * 1000);

  if (hoursSince >= 1.9 && hoursSince < 3.0) {
    decisions.push({
      template: 'post-purchase-nudge',
      payload: {
        ownerFullName: milestones.ownerFullName,
        locale: milestones.locale,
      },
    });
  }

  return decisions;
}

/**
 * First-success celebration: sent once after user's first video row is created.
 * Window: 0-30 min after first video creation (so it's timely).
 */
export function evaluatePostPurchaseFirstSuccessEmails(
  milestones: PostPurchaseFirstSuccessMilestones,
  now: number = Date.now(),
): EmailDecision[] {
  const decisions: EmailDecision[] = [];
  const minsSince = (now - milestones.firstVideoCreatedAt) / (60 * 1000);

  if (minsSince >= 0 && minsSince < 30) {
    decisions.push({
      template: 'post-purchase-first-success',
      payload: {
        ownerFullName: milestones.ownerFullName,
        locale: milestones.locale,
      },
    });
  }

  return decisions;
}
