import type { PartnerTier } from '@/seed/types/affiliate';
import type {
  CalculateCommissionInput,
  CommissionCalculationResult,
  ShareLinkOptions,
} from './types';

/**
 * Generate a clean, unique partner referral code.
 */
export function generatePartnerCode(seed?: string): string {
  if (seed && seed.trim().length > 0) {
    const clean = seed
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12);
    if (clean.length >= 3) {
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `${clean}${suffix}`;
    }
  }
  const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SOPHIA_${randomChars}`;
}

/**
 * Generate a personalized share link with tracking parameters.
 */
export function generateShareLink(code: string, options: ShareLinkOptions = {}): string {
  const base = (options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network').replace(/\/$/, '');
  const url = new URL(base);
  url.searchParams.set('ref', code);

  if (options.subId) {
    url.searchParams.set('sub_id', options.subId);
  }
  if (options.utmSource) {
    url.searchParams.set('utm_source', options.utmSource);
  }
  if (options.utmCampaign) {
    url.searchParams.set('utm_campaign', options.utmCampaign);
  }
  if (options.utmMedium) {
    url.searchParams.set('utm_medium', options.utmMedium);
  }

  return url.toString();
}

/**
 * Calculate multi-tier recurring MRR commission.
 * - Tier 1: 20% base rate (STANDARD), 30% for high volume (>5 sales, VIP/SUPER).
 * - Tier 2: 5% override.
 */
export function calculatePartnerCommission(input: CalculateCommissionInput): CommissionCalculationResult {
  const { orderAmountCents, activeSalesCount, isTier2 = false, customRatePct } = input;

  if (orderAmountCents <= 0) {
    return {
      ratePct: 0,
      commissionCents: 0,
      tier: isTier2 ? 'TIER2' : 'STANDARD',
      isTier2,
    };
  }

  if (isTier2) {
    const ratePct = 5.0;
    const commissionCents = Math.round(orderAmountCents * (ratePct / 100));
    return {
      ratePct,
      commissionCents,
      tier: 'TIER2',
      isTier2: true,
    };
  }

  // Tier 1 calculation: 20% default, 30% for high volume (>5 sales)
  let tier: PartnerTier = 'STANDARD';
  let defaultRatePct = 20.0;

  if (activeSalesCount > 5) {
    tier = activeSalesCount > 20 ? 'SUPER' : 'VIP';
    defaultRatePct = 30.0;
  }

  const ratePct = customRatePct !== undefined && customRatePct > defaultRatePct ? customRatePct : defaultRatePct;
  const commissionCents = Math.round(orderAmountCents * (ratePct / 100));

  return {
    ratePct,
    commissionCents,
    tier,
    isTier2: false,
  };
}
