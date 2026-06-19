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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScamRiskBreakdown {
  /** Domain is on known-bad blacklist (0 or 1) */
  blacklistedDomain: number;
  /** Domain uses a suspicious TLD (0 or 1) */
  suspiciousTld: number;
  /** Product name/description contains MLM keywords (0..1 proportional) */
  mlmKeywords: number;
  /** Product name/description contains scam phrases (0..1 proportional) */
  scamPhrases: number;
  /** Composite brand-copy signal: name closely copies known brand (0 or 1) */
  copycatBrand: number;
}

export interface ScamDetectionResult {
  /** Composite scam risk 0..1 */
  scamRisk: number;
  breakdown: ScamRiskBreakdown;
  /** List of signals that fired */
  signals: string[];
}

// ---------------------------------------------------------------------------
// Weights for composite risk score
// ---------------------------------------------------------------------------

const RISK_WEIGHTS: Record<keyof ScamRiskBreakdown, number> = {
  // blacklistedDomain set to 0.55 so a single blacklisted domain triggers auto-fail (>= 0.5)
  blacklistedDomain: 0.55,
  suspiciousTld: 0.12,
  mlmKeywords: 0.17,
  scamPhrases: 0.10,
  copycatBrand: 0.06,
};

// Known legitimate brands whose names are commonly spoofed
const KNOWN_BRANDS = [
  'binance', 'coinbase', 'kraken', 'bitget', 'bybit', 'okx', 'huobi', 'kucoin',
  'metamask', 'ledger', 'trezor', 'uniswap', 'opensea', 'stripe', 'paypal', 'shopify',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url.startsWith('http') ? url : `https://${url}`);
    return hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function extractTld(domain: string): string {
  const parts = domain.split('.');
  return parts.length >= 2 ? `.${parts[parts.length - 1]}` : '';
}

function containsKeywords(text: string, keywords: string[]): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  const hits = keywords.filter((kw) => lower.includes(kw.toLowerCase()));
  // Proportional 0..1: 1+ keywords → non-zero, caps at 1.0 after 3+ hits
  return Math.min(hits.length / 3, 1.0);
}

function isCopycatBrand(productName: string, productUrl?: string): boolean {
  const combined = `${productName} ${productUrl ?? ''}`.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    // Detect slight misspelling or appended strings: "binance-pro", "coinbasee", etc.
    const regex = new RegExp(`\\b${brand}(?:[^a-z]|[a-z]{1,3})?\\b`, 'i');
    if (regex.test(combined)) {
      // OK if productUrl actually IS the real brand domain
      if (productUrl) {
        const domain = extractDomain(productUrl);
        if (domain.endsWith(`${brand}.com`) || domain === `${brand}.io`) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
