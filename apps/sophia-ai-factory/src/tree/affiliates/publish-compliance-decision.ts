/**
 * publish-compliance-decision.ts — Decide and build what a campaign may publish.
 *
 * Pure: no I/O, no network, no clock. The caller supplies the jurisdiction,
 * which is the only fact this module cannot determine on its own — campaigns do
 * not carry a country, and inventing one is precisely the mistake the
 * compliance gate exists to prevent.
 *
 * Zero actor-specific defaults are applied:
 *   - a blocked verdict → publish nothing
 *   - a verdict mandating disclosure that yields no text → publish nothing
 *   - an allowed verdict → publish the gated description
 *   - no affiliate offer at all → legacy behavior, no compliance cost
 *
 * @module tree/affiliates/publish-compliance-decision
 */

import { evaluateDistributionLegality } from './distribution-compliance-gate';
import { composePublishDescription } from './publish-description';

/** Offer facts; null means the campaign carries no tracked affiliate link. */
export interface PublishDecisionOffer {
  productName: string;
  shortUrl: string;
  /** Catalog categorisation or source, used to classify the compliance vertical. */
  category?: string | null;
}

export interface PublishDecisionParams {
  baseDescription: string;
  offer: PublishDecisionOffer | null;
  /** ISO-3166-1 alpha-2 or 'EU'; null means the tenant has not declared one. */
  jurisdiction: string | null;
  locale: 'en' | 'vi';
}

export interface PublishDecision {
  /** False means the caller must not publish anything. */
  mayPublish: boolean;
  /** Machine-readable block reason, present only when `mayPublish` is false. */
  reason?: string;
  /** Human explanation for logs and for the campaign owner. */
  detail: string;
  /** Description to publish when allowed; base description when blocked. */
  description: string;
  /** Compliance vertical of the attached offer. */
  vertical: string;
  /** Whether the mandated affiliate disclosure wording was emitted. */
  affiliateDisclosureEmitted: boolean;
  /** Whether the mandated financial disclaimer wording was emitted. */
  financialDisclaimerEmitted: boolean;
}

/**
 * Reach the compliance conclusion and compose the matching description in one
 * pass, so no caller can accidentally apply the description without the verdict
 * that authorised it.
 */
export function decidePublishCompliance(params: PublishDecisionParams): PublishDecision {
  const { baseDescription, offer, jurisdiction, locale } = params;

  const verdict = evaluateDistributionLegality({
    offerCategory: offer?.category ?? null,
    offerName: offer?.productName ?? null,
    jurisdiction,
    hasAffiliateLink: Boolean(offer),
  });

  const composed = composePublishDescription({
    baseDescription,
    offer,
    verdict,
    jurisdiction,
    locale,
  });

  if (composed.blocked) {
    return {
      mayPublish: false,
      reason: composed.reason,
      detail: composed.detail,
      description: baseDescription,
      vertical: verdict.vertical,
      affiliateDisclosureEmitted: false,
      financialDisclaimerEmitted: false,
    };
  }

  return {
    mayPublish: true,
    detail: verdict.detail,
    description: composed.description,
    vertical: verdict.vertical,
    affiliateDisclosureEmitted: composed.affiliateDisclosureEmitted,
    financialDisclaimerEmitted: composed.financialDisclaimerEmitted,
  };
}
