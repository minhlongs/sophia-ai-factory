/**
 * Scam Heuristic Helpers & Weights for Affiliate Offer Evaluation.
 *
 * @module land/affiliates/scout/scam-heuristics
 */

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

export const RISK_WEIGHTS: Record<keyof ScamRiskBreakdown, number> = {
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

export function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url.startsWith('http') ? url : `https://${url}`);
    return hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function extractTld(domain: string): string {
  const parts = domain.split('.');
  return parts.length >= 2 ? `.${parts[parts.length - 1]}` : '';
}

export function containsKeywords(text: string, keywords: string[]): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  const hits = keywords.filter((kw) => lower.includes(kw.toLowerCase()));
  // Proportional 0..1: 1+ keywords -> non-zero, caps at 1.0 after 3+ hits
  return Math.min(hits.length / 3, 1.0);
}

export function isCopycatBrand(productName: string, productUrl?: string): boolean {
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
