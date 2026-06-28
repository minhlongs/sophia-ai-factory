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
import { QUOTA_LIMITS } from '@/forest/usage-metering/aggregator';
import { PRICING_TIERS } from '@/land/billing/billing-types';

interface UsageSummaryLicenseRow {
  nonce: string;
  tier: string;
  created_by: string;
}

type BillingUsageStatus = 'ok' | 'warning' | 'critical' | 'overage';

function buildBillingUsageSummary(params: {
  periodStart: number;
  periodEnd: number;
  tier: string;
  apiCalls: number;
  apiCallLimit: number;
  apiCallPercentage: number;
  apiCallStatus: BillingUsageStatus;
  overageEvents?: {
    total: number;
    totalCredits: number;
    byType: Record<string, number>;
    billableEvents: number;
  };
  projectedCharges?: {
    basePriceCents: number;
    overageChargesCents: number;
    totalCents: number;
    currency: string;
    gracePeriodCredits: number;
    billableCredits: number;
  };
  licenseNonce?: string | null;
}) {
  return {
    period: {
      start: params.periodStart,
      end: params.periodEnd,
    },
    usage: {
      apiCalls: params.apiCalls,
      videoGenerations: 0,
      storage: 0,
    },
    limits: {
      apiCalls: params.apiCallLimit,
      videoGenerations: 0,
      storage: 0,
    },
    percentages: {
      apiCalls: params.apiCallPercentage,
      videoGenerations: 0,
      storage: 0,
    },
    status: {
      apiCalls: params.apiCallStatus,
      videoGenerations: 'ok' as const,
      storage: 'ok' as const,
    },
    overageEvents: params.overageEvents ?? {
      total: 0,
      totalCredits: 0,
      byType: {},
      billableEvents: 0,
    },
    projectedCharges: params.projectedCharges ?? {
      basePriceCents: 0,
      overageChargesCents: 0,
      totalCents: 0,
      currency: 'USD',
      gracePeriodCredits: 0,
      billableCredits: 0,
    },
    license: {
      nonce: params.licenseNonce ? `${params.licenseNonce.slice(0, 8)}...` : null,
      tier: params.tier,
    },
  };
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

    // Get current period timestamps
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();

    if (!license) {
      const limits = QUOTA_LIMITS.BASIC;

      return NextResponse.json(buildBillingUsageSummary({
        periodStart,
        periodEnd,
        tier: 'BASIC',
        apiCalls: 0,
        apiCallLimit: limits.monthlyCredits,
        apiCallPercentage: 0,
        apiCallStatus: 'ok',
        licenseNonce: null,
      }));
    }

    const tier = (license.tier || 'BASIC').toUpperCase();
    const pricingTier = PRICING_TIERS[tier as keyof typeof PRICING_TIERS] ?? PRICING_TIERS.BASIC;

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

    return NextResponse.json(buildBillingUsageSummary({
      periodStart,
      periodEnd,
      tier,
      apiCalls: quotaStatus.usage.requests,
      apiCallLimit: quotaStatus.limits.dailyRequests,
      apiCallPercentage: quotaStatus.limits.dailyRequests > 0
        ? (quotaStatus.usage.requests / quotaStatus.limits.dailyRequests) * 100
        : 0,
      apiCallStatus: quotaStatus.status,
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
      licenseNonce: license.nonce,
    }));
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
