/**
 * distribution-compliance-gate.ts — Decide whether a finished campaign video
 * may be published to distribution channels.
 *
 * This is the legality gate for the live video path. It is pure: no I/O, no
 * network, no clock. The caller supplies every fact it needs.
 *
 * Failure policy is asymmetric on purpose:
 *   - A compliance fact that is UNKNOWN resolves to BLOCKED. Publishing
 *     regulated content into an unknown jurisdiction is the one mistake that
 *     cannot be undone cheaply, so uncertainty must not pass.
 *   - A technical failure elsewhere (ffmpeg missing, network down) is the
 *     caller's concern and must not be represented as a compliance verdict.
 *
 * @module land/affiliates/distribution-compliance-gate
 */

import {
  isCryptoBlockedInJurisdiction,
  type CryptoJurisdiction,
} from '@/seed/config/crypto-disclaimer-registry';
import {
  classifyOfferVertical,
  isRegulatedVertical,
  type AffiliateVertical,
} from './niche-classifier';

export interface ComplianceGateInput {
  /** Offer category from the catalog. May be null when no offer is attached. */
  offerCategory?: string | null;
  offerName?: string | null;
  /** ISO-3166-1 alpha-2 (or 'EU') code of the audience being published to. */
  jurisdiction: string | null | undefined;
  /** Whether the description carries a tracked affiliate link. */
  hasAffiliateLink: boolean;
}

export type ComplianceBlockReason =
  | 'jurisdiction_unknown'
  | 'crypto_prohibited_in_jurisdiction'
  | 'disclosure_required';

export interface ComplianceGateResult {
  /** False means the caller must not publish. */
  allowed: boolean;
  /** Stable machine-readable reason, present only when allowed is false. */
  reason?: ComplianceBlockReason;
  /** Human-readable explanation for logs and for the campaign owner. */
  detail: string;
  /** Resolved vertical, always returned so callers can branch without re-classifying. */
  vertical: AffiliateVertical;
  /** True when the description must carry an affiliate disclosure line. */
  requiresAffiliateDisclosure: boolean;
  /** True when the video must carry a financial-promotion disclaimer overlay. */
  requiresFinancialDisclaimer: boolean;
}

/** Verticals that are outright prohibited where a ban applies. */
function isProhibitedFromJurisdiction(
  vertical: AffiliateVertical,
  jurisdiction: string,
): boolean {
  if (vertical !== 'crypto' && vertical !== 'trading') return false;
  return isCryptoBlockedInJurisdiction(jurisdiction);
}

/**
 * Evaluate whether the content may be published.
 *
 * Precedence of blocks (most severe first):
 *   1. regulated vertical + unknown jurisdiction  → blocked
 *   2. regulated vertical + prohibited jurisdiction → blocked
 *   3. regulated vertical + permitted jurisdiction → allowed, overlay required
 *   4. non-regulated vertical                      → allowed as before
 */
export function evaluateDistributionLegality(
  input: ComplianceGateInput,
): ComplianceGateResult {
  const vertical = classifyOfferVertical({
    category: input.offerCategory,
    productName: input.offerName,
  });

  const hasJurisdiction = typeof input.jurisdiction === 'string' && input.jurisdiction.trim().length > 0;
  const regulated = isRegulatedVertical(vertical);

  const requiresAffiliateDisclosure = Boolean(input.hasAffiliateLink);

  if (!regulated) {
    return {
      allowed: true,
      detail: `Vertical "${vertical}" is not a regulated financial vertical.`,
      vertical,
      requiresAffiliateDisclosure,
      requiresFinancialDisclaimer: false,
    };
  }

  if (!hasJurisdiction) {
    return {
      allowed: false,
      reason: 'jurisdiction_unknown',
      detail:
        `Vertical "${vertical}" is regulated, but the target jurisdiction is unknown. ` +
        'Refusing to publish rather than guess: an unknown jurisdiction may be one where ' +
        'promotion is prohibited.',
      vertical,
      requiresAffiliateDisclosure,
      requiresFinancialDisclaimer: false,
    };
  }

  if (isProhibitedFromJurisdiction(vertical, input.jurisdiction as string)) {
    const code = input.jurisdiction as CryptoJurisdiction;
    return {
      allowed: false,
      reason: 'crypto_prohibited_in_jurisdiction',
      detail:
        `Promotion of "${vertical}" content is prohibited in ${code}. ` +
        'Publishing would create legal exposure for both the account owner and the platform.',
      vertical,
      requiresAffiliateDisclosure,
      requiresFinancialDisclaimer: false,
    };
  }

  return {
    allowed: true,
    detail:
      `Vertical "${vertical}" may be published in ${input.jurisdiction} provided the required ` +
      'disclosure and disclaimer overlay are applied.',
    vertical,
    requiresAffiliateDisclosure,
    requiresFinancialDisclaimer: true,
  };
}
