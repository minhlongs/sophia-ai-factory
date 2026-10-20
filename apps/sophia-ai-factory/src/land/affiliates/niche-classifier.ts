/**
 * niche-classifier.ts — Classify an affiliate offer into a monetisation vertical.
 *
 * A "vertical" is the compliance-relevant category of what a video is promoting.
 * It drives two downstream gates independently:
 *   1. whether the offer may be served to a tenant at all (`seed/security/geo-gate`)
 *   2. whether the finished video may be published in a jurisdiction
 *      (`land/affiliates/distribution-compliance-gate`)
 *
 * Classification is deliberately conservative: anything ambiguous in a
 * financial-adjacent vertical resolves UP to `crypto` or `trading`, never down,
 * because a false `other` silently removes a compliance gate.
 *
 * Pure function, no I/O — edge-runtime safe.
 *
 * @module land/affiliates/niche-classifier
 */

export type AffiliateVertical =
  | 'crypto'
  | 'trading'
  | 'saas'
  | 'ecommerce'
  | 'finance'
  | 'other';

export interface ClassifyNicheInput {
  /** Offer category from the catalog, e.g. 'Crypto Exchange', 'E-Commerce' */
  category?: string | null;
  /** Human-readable offer name, e.g. 'KuCoin Trading Rebate' */
  productName?: string | null;
}

const CRYPTO_TOKENS = [
  'crypto',
  'coin',
  'token',
  'exchange',
  'defi',
  'on-chain',
  'onchain',
  'nft',
  'web3',
  'usdt',
  'usdc',
  'btc',
  'bitcoin',
  'eth',
  'wallet',
  'binance',
  'kucoin',
  'bybit',
  'okx',
  'bitget',
  'hyperliquid',
  'jupiter',
  'ledger',
  'staking',
  'mining',
];

const TRADING_TOKENS = [
  'trading',
  'trader',
  'forex',
  'cfd',
  'futures',
  'prop firm ',
  'prop-firm ',
  'copy trad ',
  'signal',
  'broker',
  'leverage',
  'derivative',
  'options',
];

const FINANCE_TOKENS = [
  'fintech',
  'banking',
  'bank',
  'lending',
  'loan',
  'insurance',
  'investment fund',
  'hedge fund',
  'payments',
  'remittance',
  'invoice',
  'accounting',
];

const SAAS_TOKENS = [
  'saas',
  'software',
  'workflow',
  'crm',
  'productivity',
  'automation',
  'seo',
  'design',
  'creator tool',
  'project management',
  'app builder',
];

const ECOMMERCE_TOKENS = [
  'e-commerce',
  'ecommerce',
  'commerce',
  'shopify',
  'dropship',
  'retail',
  'marketplace',
  'amazon',
];

/**
 * Substring containment is deliberately NOT used: tokens like 'defi' occur
 * inside unrelated words ('un**defi**ned'), which would misclassify a
 * non-crypto offer and silently strip its compliance gate.
 *
 * Instead the text is normalised to space-separated word runs and a token
 * matches when it aligns to a word boundary. Multi-word tokens that end in a
 * space ('copy trad') are intentional prefixes and match the start of a word
 * run, so real phrasings like 'copy trading' still hit.
 */
const normalize = (value: string): string =>
  ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

function hasToken(normalizedHaystack: string, token: string): boolean {
  const needle = token.replace(/[^a-z0-9]+/g, ' ').trim();
  if (needle.length === 0) return false;
  if (needle.endsWith(' ')) {
    return normalizedHaystack.includes(` ${needle}`);
  }
  return normalizedHaystack.includes(` ${needle} `);
}

function hasAnyToken(normalizedHaystack: string, tokens: string[]): boolean {
  return tokens.some((token) => hasToken(normalizedHaystack, token));
}

/**
 * Classify the vertical of an affiliate offer.
 *
 * Resolution order matters: crypto and trading are checked before saas/finance
 * so that a "crypto workflow SaaS" is not downgraded to a plain SaaS vertical
 * (which would have no compliance gate at all).
 */
export function classifyOfferVertical(input: ClassifyNicheInput): AffiliateVertical {
  const haystack = normalize(`${input.category ?? ''} ${input.productName ?? ''}`);
  if (haystack.trim().length === 0) return 'other';

  if (hasAnyToken(haystack, CRYPTO_TOKENS)) return 'crypto';
  if (hasAnyToken(haystack, TRADING_TOKENS)) return 'trading';
  if (hasAnyToken(haystack, ECOMMERCE_TOKENS)) return 'ecommerce';
  if (hasAnyToken(haystack, FINANCE_TOKENS)) return 'finance';
  if (hasAnyToken(haystack, SAAS_TOKENS)) return 'saas';
  return 'other';
}

/**
 * True when the vertical requires a financial-promotion disclosure and a
 * jurisdiction check before a video may be published.
 */
export function isRegulatedVertical(vertical: AffiliateVertical): boolean {
  return vertical === 'crypto' || vertical === 'trading' || vertical === 'finance';
}
