/**
 * GET /api/admin/billing/summary
 *
 * Get aggregate billing summary for admin dashboard
 * - MRR (Monthly Recurring Revenue)
 * - Dunning state counts (current, past_due, delinquent, suspended)
 * - Unbilled overage total
 * - Active licenses count
 *
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { checkAdminAuth } from '../../middleware';

/**
 * Billing summary response
 */
interface BillingSummary {
  /** Monthly Recurring Revenue in cents */
  mrr: number;
  /** MRR currency */
  currency: string;
  /** Dunning state counts */
  dunningStates: {
    current: number;
    past_due: number;
    delinquent: number;
    suspended: number;
  };
  /** Total unbilled overage amount in cents */
  unbilledOverageTotal: number;
  /** Count of active licenses */
  activeLicensesCount: number;
  /** Count of licenses with dunning issues */
  licensesWithIssues: number;
  /** Timestamp of summary generation */
  generatedAt: string;
}

export async function GET(req: NextRequest) {
  try {
    // Check admin auth
    const authError = checkAdminAuth(req);
    if (authError) return authError;

    const supabase = createAdminClient();

    // Parallel fetch all summary data
    const [
      mrrResult,
      dunningStatesResult,
      unbilledOverageResult,
      activeLicensesResult,
      licensesWithIssuesResult,
    ] = await Promise.all([
      // Calculate MRR from active subscriptions
      supabase
        .from('dunning_settings')
        .select('polar_customer_id, stripe_customer_id, dunning_state')
        .eq('dunning_state', 'current'),
      // Get dunning state counts
      supabase
        .from('dunning_settings')
        .select('dunning_state')
        .order('dunning_state'),
      // Get unbilled overage total
      supabase
        .from('overage_events')
        .select('exceeded_by, tier_at_exceeded')
        .eq('billable', false),
      // Count active licenses
      supabase
        .from('raas_api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      // Count licenses with dunning issues
      supabase
        .from('dunning_settings')
        .select('id', { count: 'exact', head: true })
        .in('dunning_state', ['past_due', 'delinquent', 'suspended']),
    ]);

    // Handle errors
    if (mrrResult.error) {
      logger.error('[Billing Summary] Error fetching MRR data', mrrResult.error);
    }
    if (dunningStatesResult.error) {
      logger.error('[Billing Summary] Error fetching dunning states', dunningStatesResult.error);
    }
    if (unbilledOverageResult.error) {
      logger.error('[Billing Summary] Error fetching unbilled overage', unbilledOverageResult.error);
    }
    if (activeLicensesResult.error) {
      logger.error('[Billing Summary] Error fetching active licenses', activeLicensesResult.error);
    }

    // Calculate MRR (simplified - based on tier pricing)
    // In production, this would come from Stripe/Polar subscription data
    const mrr = calculateMRR(mrrResult.data || []);

    // Count dunning states
    const dunningStates = {
      current: 0,
      past_due: 0,
      delinquent: 0,
      suspended: 0,
    };

    interface DunningRow {
      dunning_state: string;
    }

    (dunningStatesResult.data || []).forEach((row: DunningRow) => {
      const state = row.dunning_state as string;
      if (state in dunningStates) {
        dunningStates[state as keyof typeof dunningStates]++;
      }
    });

    // Calculate unbilled overage total
    let unbilledOverageTotal = 0;
    const pricingTiers: Record<string, number> = {
      BASIC: 0.10,
      PREMIUM: 0.05,
      ENTERPRISE: 0.03,
      MASTER: 0.02,
    };

    interface OverageRow {
      tier_at_exceeded: string;
      exceeded_by: number;
    }

    (unbilledOverageResult.data || []).forEach((row: OverageRow) => {
      const tier = row.tier_at_exceeded as string;
      const exceededBy = row.exceeded_by as number;
      const pricePerCredit = pricingTiers[tier] || 0.10;
      unbilledOverageTotal += exceededBy * pricePerCredit;
    });

    // Convert to cents
    const unbilledOverageCents = Math.round(unbilledOverageTotal * 100);

    const summary: BillingSummary = {
      mrr: mrr.totalCents,
      currency: 'USD',
      dunningStates,
      unbilledOverageTotal: unbilledOverageCents,
      activeLicensesCount: activeLicensesResult.count || 0,
      licensesWithIssues: licensesWithIssuesResult.count || 0,
      generatedAt: new Date().toISOString(),
    };

    logger.info('[Billing Summary] Retrieved summary', {
      mrr: summary.mrr,
      dunningStates: summary.dunningStates,
      unbilledOverageTotal: summary.unbilledOverageTotal,
      activeLicensesCount: summary.activeLicensesCount,
    });

    return NextResponse.json(summary);
  } catch (error) {
    logger.error('[Billing Summary] Error', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch billing summary' },
      { status: 500 }
    );
  }
}

/**
 * Calculate MRR from dunning settings
 * Simplified calculation based on tier assumptions
 */
interface MRRResult {
  totalCents: number;
  breakdown: Record<string, number>;
}

interface DunningCustomer {
  polar_customer_id?: string;
  stripe_customer_id?: string;
  dunning_state?: string;
}

function calculateMRR(data: DunningCustomer[]): MRRResult {
  // Tier pricing (monthly)
  const tierPricing: Record<string, number> = {
    BASIC: 4900,      // $49/month
    PREMIUM: 9900,    // $99/month
    ENTERPRISE: 24900, // $249/month
    MASTER: 49900,    // $499/month
  };

  const breakdown: Record<string, number> = {
    BASIC: 0,
    PREMIUM: 0,
    ENTERPRISE: 0,
    MASTER: 0,
  };

  // Note: This is simplified - in production would need actual subscription data
  // For now, estimate based on customer count
  const customerCount = data.length;

  // Distribute evenly across tiers (simplified assumption)
  if (customerCount > 0) {
    const perTier = Math.floor(customerCount / 4);
    const remaining = customerCount % 4;

    let index = 0;
    const tiers = Object.keys(tierPricing);

    for (let i = 0; i < customerCount; i++) {
      const tier = tiers[index % tiers.length];
      breakdown[tier]++;
      index++;
    }
  }

  const totalCents = Object.entries(breakdown).reduce(
    (sum, [tier, count]) => sum + (count * tierPricing[tier]),
    0
  );

  return { totalCents, breakdown };
}
