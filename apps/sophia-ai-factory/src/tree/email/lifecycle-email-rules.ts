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
  | 'setup-complete'
  | 'tools-nudge'
  | 're-engagement-d14'
  | 'win-back'
  | 'affiliate-day1-tutorial'
  | 'affiliate-day7-case-study'
  | 'post-purchase-welcome'
  | 'post-purchase-nudge'
  | 'post-purchase-first-success';

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

// ─── Tools Nudge (Day 4) ────────────────────────────────────────────────────

export interface ToolsNudgeMilestones {
  signupAt: number;             // ms
  firstLoginAt: number | null;
  firstVideoCreatedAt: number | null;
  ownerFullName: string;
  locale: string;
}

/**
 * Day-4 tools-nudge: highlight 3 power features for users who already shipped
 * their first video. Gates: signup ≥3.9d ago AND firstLogin AND firstVideo.
 * Distinct from `activation-reminder` (D+3, NO first video).
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

// ─── Re-Engagement D+14 (active subscription, gone quiet) ───────────────────

export interface ReEngagementD14Milestones {
  signupAt: number;             // ms
  /** Most recent meaningful activity (max of last login or last video). null if never active. */
  lastActivityAt: number | null;
  /** Required: only target users whose subscription is still active. */
  subscriptionActive: boolean;
  ownerFullName: string;
  locale: string;
}

/**
 * Day-14 re-engagement: still-paying users who went quiet for 7+ days.
 * Gates: signup ≥13.9d ago AND subscription still active AND no activity for ≥7d.
 * Distinct from `win-back` (D+60, targets CANCELLED users).
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

// ─── Affiliate Lifecycle (Day 1 tutorial + Day 7 case study) ────────────────

export interface AffiliateMilestones {
  /** Enrollment timestamp — when referral code was generated. */
  enrolledAt: number;
  ownerFullName: string;
  locale: string;
  referralCode: string;
  /** Optional Day-7 personalization stats — when omitted, case-study email skips the "your week 1" block. */
  totalClicks?: number;
  totalConversions?: number;
  pendingEarningsUsd?: number;
}

/**
 * Affiliate Day-1 first-link tutorial + Day-7 case study.
 * No engagement gating beyond the time window — every enrolled affiliate gets both
 * to maximize first-conversion velocity. Email-drip cron is responsible for
 * idempotency (deduping per (user_id, template) pair).
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

// ─── Post-Purchase Welcome (immediate — payment confirmed) ──────────────────

export interface PostPurchaseWelcomeMilestones {
  /** Unix ms timestamp of payment confirmation. */
  purchasedAt: number;
  onboardingCompletedAt: number | null;
  ownerFullName: string;
  /** Tier label, e.g. 'BASIC', 'PREMIUM', etc. */
  tier: string;
  locale: string;
}

/**
 * Immediate post-purchase welcome.
 * Sent once, right after payment_confirmed — gates: purchasedAt within last 30 min.
 * The IPN handler enqueues this directly; this evaluator is for drip-cron backfill
 * (catches edge cases where IPN enqueue failed).
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

// ─── Post-Purchase Nudge (2h after purchase, setup not done) ────────────────

export interface PostPurchaseNudgeMilestones {
  /** Unix ms timestamp of payment confirmation. */
  purchasedAt: number;
  onboardingCompletedAt: number | null;
  ownerFullName: string;
  locale: string;
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

// ─── Post-Purchase First Success (first video created) ──────────────────────

export interface PostPurchaseFirstSuccessMilestones {
  /** Unix ms timestamp of first video creation. */
  firstVideoCreatedAt: number;
  ownerFullName: string;
  locale: string;
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
