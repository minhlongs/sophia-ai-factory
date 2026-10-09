/**
 * Co-Op Marketing Funds Engine Constants
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/constants
 */

/** Standard 5.0% monthly Co-Op marketing accrual rate for Gold & Platinum tiers */
export const CO_OP_ACCRUAL_RATE_PCT = 5.0;

/** Budget allocation expiration period: 90 days */
export const CO_OP_BUDGET_EXPIRY_DAYS = 90;
export const CO_OP_BUDGET_EXPIRY_MS = CO_OP_BUDGET_EXPIRY_DAYS * 86_400 * 1000;

/** Grace period for invoice date relative to billing cycle: 15 days */
export const CO_OP_GRACE_PERIOD_DAYS = 15;
export const CO_OP_GRACE_PERIOD_MS = CO_OP_GRACE_PERIOD_DAYS * 86_400 * 1000;

/** Minimum appraisal score for automated approval */
export const AUTO_APPROVAL_SCORE_THRESHOLD = 85;

/** Maximum claim amount in cents for automated approval ($2,000.00) */
export const AUTO_APPROVAL_MAX_AMOUNT_CENTS = 200_000;

/** Recognized major ad networks & verified platforms */
export const VERIFIED_AD_NETWORKS = [
  'google',
  'meta',
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'twitter',
  'x ads',
  'x.com',
  'youtube',
  'apple search',
  'bing',
  'microsoft',
] as const;

/** Brand keywords required in campaign metadata or proof */
export const SOPHIA_BRAND_KEYWORDS = [
  'sophia',
  'agencyos',
  'ai factory',
  'sophia-ai',
  'sophia ai',
] as const;
