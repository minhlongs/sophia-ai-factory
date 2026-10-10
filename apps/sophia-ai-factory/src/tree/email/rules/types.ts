/**
 * Lifecycle email rule types and constants.
 *
 * @module tree/email/rules/types
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

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
  createdAt: number; // ms
  firstLoginAt: number | null;
  firstSopInstallAt: number | null;
  ownerFullName: string;
  locale: string;
  magicLinkUrl?: string;
}

export interface ActivationMilestones {
  signupAt: number; // ms
  firstLoginAt: number | null;
  firstVideoCreatedAt: number | null;
  ownerFullName: string;
  locale: string;
}

export interface ToolsNudgeMilestones {
  signupAt: number; // ms
  firstLoginAt: number | null;
  firstVideoCreatedAt: number | null;
  ownerFullName: string;
  locale: string;
}

export interface ReEngagementD14Milestones {
  signupAt: number; // ms
  /** Most recent meaningful activity (max of last login or last video). null if never active. */
  lastActivityAt: number | null;
  /** Required: only target users whose subscription is still active. */
  subscriptionActive: boolean;
  ownerFullName: string;
  locale: string;
}

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

export interface PostPurchaseWelcomeMilestones {
  /** Unix ms timestamp of payment confirmation. */
  purchasedAt: number;
  onboardingCompletedAt: number | null;
  ownerFullName: string;
  /** Tier label, e.g. 'BASIC', 'PREMIUM', etc. */
  tier: string;
  locale: string;
}

export interface PostPurchaseNudgeMilestones {
  /** Unix ms timestamp of payment confirmation. */
  purchasedAt: number;
  onboardingCompletedAt: number | null;
  ownerFullName: string;
  locale: string;
}

export interface PostPurchaseFirstSuccessMilestones {
  /** Unix ms timestamp of first video creation. */
  firstVideoCreatedAt: number;
  ownerFullName: string;
  locale: string;
}

export interface WinBackMilestones {
  cancelledAt: number; // ms — when subscription was cancelled
  cancelledAtIso: string; // ISO date string for copy ("since {date}")
  reactivatedAt: number | null; // null if user has not returned
  ownerFullName: string;
  locale: string;
  /** Optional discount code to embed in the email. */
  discountCode?: string;
  discountPercent?: number;
}
