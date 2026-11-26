/**
 * Clean-Room Delayed-Comment Affiliate Plug Orchestrator.
 *
 * Separates organic main-post captions (zero outbound links to avoid reach
 * suppression on X, TikTok, Reels, LinkedIn) from delayed first-comment
 * affiliate plugs containing the tracked /api/r/[code] shortlink and
 * jurisdiction-compliant disclosure via runPolicyPreflight().
 *
 * Layer: forest/publishing (orchestration, imports seed/ only)
 *
 * @module forest/publishing/delayed-comment-plug
 */

import {
  runPolicyPreflight,
  type ComplianceJurisdiction,
  type CompliancePlatform,
  type ComplianceVertical,
} from '@/seed/compliance/policy-preflight-engine';

export interface DelayedCommentPlugInput {
  readonly mainCaption: string;
  readonly ctaText: string;
  readonly affiliateShortUrl: string;
  readonly delayMinutes?: number;
  readonly jurisdiction?: ComplianceJurisdiction;
  readonly platform?: CompliancePlatform;
  readonly vertical?: ComplianceVertical;
}

export interface DelayedCommentPlugPlan {
  readonly cleanMainCaption: string;
  readonly firstCommentBody: string;
  readonly delayMinutes: number;
  readonly executeAtOffsetMs: number;
  readonly disclosureApplied: string;
}

const DEFAULT_DELAY_MINUTES = 3;
const MAX_DELAY_MINUTES = 60;

/**
 * Strips raw URLs from the main post body so social algorithms do not throttle
 * organic reach, and moves the affiliate shortlink + mandatory disclosure into
 * a scheduled delayed first-comment plug.
 */
export function buildDelayedCommentPlugPlan(
  input: DelayedCommentPlugInput,
): DelayedCommentPlugPlan {
  const safeDelay = Math.min(
    MAX_DELAY_MINUTES,
    Math.max(0, Math.round(input.delayMinutes ?? DEFAULT_DELAY_MINUTES)),
  );

  const captionPreflight = runPolicyPreflight({
    text: input.mainCaption.replace(/https?:\/\/\S+/gi, '').replace(/\s{2,}/g, ' ').trim(),
    jurisdiction: input.jurisdiction ?? 'GLOBAL',
    platform: input.platform ?? 'tiktok',
    vertical: input.vertical ?? 'crypto',
  });

  const cleanCta = input.ctaText.trim() || 'Details & link:';
  const firstCommentBody = [
    cleanCta,
    input.affiliateShortUrl.trim(),
    captionPreflight.requiredDisclosure,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    cleanMainCaption: captionPreflight.sanitizedText,
    firstCommentBody,
    delayMinutes: safeDelay,
    executeAtOffsetMs: safeDelay * 60 * 1000,
    disclosureApplied: captionPreflight.requiredDisclosure,
  };
}
