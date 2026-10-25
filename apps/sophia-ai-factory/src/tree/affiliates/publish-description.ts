/**
 * publish-description.ts — Compose the channel description a campaign publishes.
 *
 * Pure: no I/O, no network, no clock. Every fact is supplied by the caller.
 *
 * Both distribution paths in this repo must produce the same description for
 * the same inputs — the live Inngest campaign path and the webhook orchestrator
 * path — otherwise the compliance conclusion one reaches is not the one the
 * other enforces. Centralising the wording is what keeps them from drifting.
 *
 * @module tree/affiliates/publish-description
 */

import type { ComplianceGateResult } from './distribution-compliance-gate';
import { buildPublishDisclosure } from './distribution-compliance-gate';

/** Offer facts the description needs; the caller owns fetching them. */
export interface PublishOfferInput {
  productName: string;
  shortUrl: string;
}

export interface DescriptionParams {
  /** Audience description written by the pipeline before any affiliate text. */
  baseDescription: string;
  /** Attached offer, or null when the campaign carries no affiliate link. */
  offer: PublishOfferInput | null;
  /** Verdict from `evaluateDistributionLegality`; null when not gated yet. */
  verdict: ComplianceGateResult | null;
  /** Jurisdiction the verdict was reached for; null when unresolved. */
  jurisdiction: string | null;
  /** Language the disclosure wording must be rendered in. */
  locale: 'en' | 'vi';
  /**
   * Disclosure wording source. Injectable so tests can drive the branch a
   * registry gap would trigger in production; defaults to the real builder.
   */
  disclosureBuilder?: (
    verdict: ComplianceGateResult,
    jurisdiction: string | null,
    locale: 'en' | 'vi',
  ) => string;
}

export interface DescriptionComposition {
  /** Text to publish. Callers send this to the channels. */
  description: string;
  /** True when a blocked verdict left the description unpublishable. */
  blocked: boolean;
  /** Machine-readable block reason, present only when `blocked` is true. */
  reason?: ComplianceGateResult['reason'];
  /** Human explanation for logs and for the campaign owner. */
  detail: string;
  /** Whether the mandated affiliate disclosure wording was emitted. */
  affiliateDisclosureEmitted: boolean;
  /** Whether the mandated financial disclaimer wording was emitted. */
  financialDisclaimerEmitted: boolean;
}

export function composePublishDescription(params: DescriptionParams): DescriptionComposition {
  const { baseDescription, offer, verdict, jurisdiction, locale } = params;
  const build = params.disclosureBuilder ?? buildPublishDisclosure;

  // A blocked verdict publishes nothing: returning the base description with
  // the link stripped is what keeps a prohibited link off the channel.
  if (verdict && !verdict.allowed) {
    return {
      description: baseDescription,
      blocked: true,
      reason: verdict.reason,
      detail: verdict.detail,
      affiliateDisclosureEmitted: false,
      financialDisclaimerEmitted: false,
    };
  }

  const requiresAffiliate = verdict?.requiresAffiliateDisclosure ?? false;
  const requiresFinancial = verdict?.requiresFinancialDisclaimer ?? false;
  const disclosure = verdict ? build(verdict, jurisdiction, locale) : '';
  const affiliateDisclosureEmitted = disclosure.length > 0 && requiresAffiliate;
  const financialDisclaimerEmitted = disclosure.length > 0 && requiresFinancial;

  // A verdict that mandates wording but produced none is a compliance hole,
  // not a cosmetic one: publishing silently drops a required disclosure.
  if (disclosure.length === 0 && (requiresAffiliate || requiresFinancial)) {
    return {
      description: baseDescription,
      blocked: true,
      reason: 'disclosure_required',
      detail:
        'The verdict requires disclosure wording, but none could be built for ' +
        'the resolved jurisdiction. Refusing to publish.',
      affiliateDisclosureEmitted: false,
      financialDisclaimerEmitted: false,
    };
  }

  // Disclosure goes above the link so a truncated preview still shows it.
  const sections = [baseDescription];
  if (disclosure.length > 0) sections.push(disclosure);
  if (offer) sections.push(`👉 ${offer.shortUrl}`);

  return {
    description: sections.join('\n\n'),
    blocked: false,
    detail: verdict?.detail ?? 'No compliance verdict was required.',
    affiliateDisclosureEmitted,
    financialDisclaimerEmitted,
  };
}
