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
 *     cannot be undone cheaply, so uncertainty must not pass. This covers both
 *     a jurisdiction the tenant never declared and one the registry has not
 *     assessed — neither is evidence that promotion is permitted there.
 *   - A technical failure elsewhere (ffmpeg missing, network down) is the
 *     caller's concern and must not be represented as a compliance verdict.
 *
 * @module tree/affiliates/distribution-compliance-gate
 */

import {
  CRYPTO_JURISDICTIONS,
  getDisclaimerForJurisdiction,
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
  | 'jurisdiction_not_assessed'
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
 * True only when the registry has actually assessed this code.
 *
 * `getDisclaimerForJurisdiction` answers for an unassessed code too, by
 * falling back to its US entry — which is permissive. Reading that answer as
 * a verdict is what let a declared but unassessed jurisdiction publish
 * regulated content, so the gate requires an explicit match and treats
 * everything else as unresolved. Callers that need text rather than a
 * verdict (overlays, captions) legitimately rely on the fallback.
 */
function isAssessedJurisdiction(jurisdiction: string): jurisdiction is CryptoJurisdiction {
  return (CRYPTO_JURISDICTIONS as readonly string[]).includes(jurisdiction.toUpperCase());
}

/**
 * Evaluate whether the content may be published.
 *
 * Precedence of blocks (most severe first):
 *   1. regulated vertical + no jurisdiction declared → blocked
 *   2. regulated vertical + jurisdiction never assessed → blocked
 *   3. regulated vertical + prohibited jurisdiction → blocked
 *   4. regulated vertical + permitted jurisdiction → allowed, overlay required
 *   5. non-regulated vertical                      → allowed as before
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

  // A declared jurisdiction the registry has not assessed is unresolved, not
  // permitted. The registry answers for such a code by falling back to its
  // permissive US entry, so consulting it here would green-light regulated
  // content in a territory whose rules nobody has checked (e.g. 'CN').
  if (!isAssessedJurisdiction(input.jurisdiction as string)) {
    return {
      allowed: false,
      reason: 'jurisdiction_not_assessed',
      detail:
        `Vertical "${vertical}" is regulated, but jurisdiction ` +
        `"${(input.jurisdiction as string).toUpperCase()}" has no assessed compliance rules. ` +
        'Refusing to publish rather than assume it behaves like a jurisdiction that has ' +
        'been assessed: an unassessed territory may prohibit promotion outright.',
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

/**
 * Build the disclosure lines a published description must carry.
 *
 * The rendered disclaimer overlay lives in `land/video/assembly` and shells out
 * to ffmpeg via Node APIs, so it cannot run inside the Workers runtime where
 * the campaign pipeline executes. The channel description is the surface that
 * *is* available in that runtime, so the mandated wording is enforced here.
 *
 * Pure: returns text only, performs no I/O.
 */
export function buildPublishDisclosure(
  verdict: ComplianceGateResult,
  jurisdiction: string | null | undefined,
  locale: 'en' | 'vi' = 'en',
): string {
  const lines: string[] = [];

  if (verdict.requiresAffiliateDisclosure) {
    lines.push(
      locale === 'vi'
        ? 'Nội dung này có chứa liên kết affiliate — nếu bạn mua qua đường link đó, chúng tôi có thể nhận hoa hồng, không mất thêm chi phí gì ở bạn.'
        : 'This content contains affiliate links and I may earn a commission at no cost to you.',
    );
  }

  if (verdict.requiresFinancialDisclaimer && jurisdiction) {
    const disclaimer = getDisclaimerForJurisdiction(jurisdiction);
    lines.push(disclaimer.short[locale]);
  }

  return lines.join(locale === 'vi' ? ' — ' : ' — ');
}
