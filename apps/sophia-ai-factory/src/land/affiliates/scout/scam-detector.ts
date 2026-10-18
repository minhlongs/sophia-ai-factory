/**
 * Scam risk detection for affiliate offers.
 *
 * Produces a composite scamRisk score 0..1 from multiple heuristics.
 * No single signal can trigger a fail — risk is composite.
 * scamRisk >= 0.5 → auto-fail in scoreAffiliate regardless of quality score.
 *
 * @module lib/affiliates/scout/scam-detector
 */

import type { Affiliate } from './types';
import blacklist from './scam-domain-blacklist.json';
import {
  RISK_WEIGHTS,
  extractDomain,
  extractTld,
  containsKeywords,
  isCopycatBrand,
  type ScamRiskBreakdown,
  type ScamDetectionResult,
} from './scam-heuristics';

export type { ScamRiskBreakdown, ScamDetectionResult };

/**
 * Compute scam risk for an affiliate offer.
 * Returns composite scamRisk 0..1 and detailed breakdown.
 */
export function detectScamRisk(aff: Affiliate): ScamDetectionResult {
  const signals: string[] = [];

  // Resolve domain from affiliate record or productUrl
  const rawDomain = aff.domain ?? (aff.productUrl ? extractDomain(aff.productUrl) : '');
  const tld = rawDomain ? extractTld(rawDomain) : '';

  // 1. Blacklisted domain
  const isBlacklisted = rawDomain
    ? (blacklist.domains as string[]).some((d) => rawDomain === d || rawDomain.endsWith(`.${d}`))
    : false;
  if (isBlacklisted) signals.push(`blacklisted-domain:${rawDomain}`);

  // 2. Suspicious TLD
  const hasSuspiciousTld = tld
    ? (blacklist.suspiciousTlds as string[]).includes(tld)
    : false;
  if (hasSuspiciousTld) signals.push(`suspicious-tld:${tld}`);

  // 3. MLM keywords in name/description
  const textForKeywords = `${aff.productName} ${aff.description ?? ''}`;
  const mlmScore = containsKeywords(textForKeywords, blacklist.mlmKeywords as string[]);
  if (mlmScore > 0) signals.push(`mlm-keywords:score=${mlmScore.toFixed(2)}`);

  // 4. Scam phrases
  const scamScore = containsKeywords(textForKeywords, blacklist.scamPhrases as string[]);
  if (scamScore > 0) signals.push(`scam-phrases:score=${scamScore.toFixed(2)}`);

  // 5. Copycat brand
  const isCopycat = isCopycatBrand(aff.productName, aff.productUrl);
  if (isCopycat) signals.push(`copycat-brand:${aff.productName}`);

  const breakdown: ScamRiskBreakdown = {
    blacklistedDomain: isBlacklisted ? 1 : 0,
    suspiciousTld: hasSuspiciousTld ? 1 : 0,
    mlmKeywords: mlmScore,
    scamPhrases: scamScore,
    copycatBrand: isCopycat ? 1 : 0,
  };

  const scamRisk =
    breakdown.blacklistedDomain * RISK_WEIGHTS.blacklistedDomain +
    breakdown.suspiciousTld * RISK_WEIGHTS.suspiciousTld +
    breakdown.mlmKeywords * RISK_WEIGHTS.mlmKeywords +
    breakdown.scamPhrases * RISK_WEIGHTS.scamPhrases +
    breakdown.copycatBrand * RISK_WEIGHTS.copycatBrand;

  return {
    scamRisk: Math.round(Math.min(scamRisk, 1.0) * 1000) / 1000,
    breakdown,
    signals,
  };
}
