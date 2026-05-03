/**
 * GET /api/billing/usage-summary
 *
 * Returns current period usage + overage charges
 * for dashboard display
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getOverageSummary } from '@/forest/quota/overage-logger';
import { getQuotaStatus } from '@/forest/quota/quota-checker';
import { PRICING_TIERS } from '@/land/billing/billing-types';

interface UsageSummaryLicenseRow {
  nonce: string;
  tier: string;
  created_by: string;
}

/**
 * GET /api/billing/usage-summary
 * Returns: { usage, limits, overageEvents, projectedCharges }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const db = createServerClient();

    // Get user's active license
    const { data: rawLicense } = await db
      .from('raas_licenses')
      .select('nonce, tier, created_by')
      .eq('created_by', user.id)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    const license = rawLicense as UsageSummaryLicenseRow | null;

    if (!license) {
      return NextResponse.json(
        { error: 'No active license found' },
        { status: 404 }
      );
    }

    const tier = (license.tier || 'BASIC').toUpperCase();
    const pricingTier = PRICING_TIERS[tier as keyof typeof PRICING_TIERS];

    // Get current period timestamps
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();

    // Get quota status
    const quotaStatus = await getQuotaStatus(
      user.id,
      license.nonce,
      tier
    );

    // Get overage summary for current period
    const overageSummary = await getOverageSummary(
      license.nonce,
      Math.floor(periodStart / 1000),
      Math.floor(periodEnd / 1000)
    );

    // Calculate projected overage charges
    const totalOverageCredits = overageSummary.totalOverageCredits;
    const gracePeriod = pricingTier.tier === 'PREMIUM' ? 50 :
                        pricingTier.tier === 'ENTERPRISE' ? 100 :
                        pricingTier.tier === 'MASTER' ? Infinity : 0;

    const billableCredits = Math.max(0, totalOverageCredits - gracePeriod);
    const overageChargesCents = Math.round(billableCredits * pricingTier.pricePerCredit * 100);

    // Get base subscription price (from user profile or license)
    const basePriceCents = await getBaseSubscriptionPriceCents(tier);

    return NextResponse.json({
      period: {
        start: periodStart,
        end: periodEnd,
      },
      usage: quotaStatus.usage,
      limits: quotaStatus.limits,
      percentages: quotaStatus.percentages,
      status: quotaStatus.status,
      overageEvents: {
        total: overageSummary.totalOverageEvents,
        totalCredits: overageSummary.totalOverageCredits,
        byType: overageSummary.byType,
        billableEvents: overageSummary.billableEvents,
      },
      projectedCharges: {
        basePriceCents,
        overageChargesCents,
        totalCents: basePriceCents + overageChargesCents,
        currency: 'USD',
        gracePeriodCredits: gracePeriod,
        billableCredits,
      },
      license: {
        nonce: license.nonce.slice(0, 8) + '...',
        tier,
      },
    });
  } catch (error) {
    logger.error('[Billing API] Error fetching usage summary', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch usage summary' },
      { status: 500 }
    );
  }
}

/**
 * Get base subscription price in cents by tier
 */
async function getBaseSubscriptionPriceCents(tier: string): Promise<number> {
  // These are example prices - adjust based on your actual pricing
  const prices: Record<string, number> = {
    BASIC: 0,          // Free tier
    PREMIUM: 2900,     // $29/month
    ENTERPRISE: 9900,  // $99/month
    MASTER: 29900,     // $299/month
  };
  return prices[tier] || 0;
}
