/**
 * @file affiliate-copilot-actions.ts
 * @description Server Action for Affiliate 7d Rolling EPC & Dynamic Tier Matching
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { calculateEpcMetrics } from '@/tree/affiliate-copilot/epc-velocity-engine';
import type { AffiliateEpcInput } from '@/seed/types/growth-triad-v4-types';

export async function evaluateAffiliateEpcAction(params: AffiliateEpcInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const metrics = calculateEpcMetrics(params);
  const now = Date.now();
  const recordId = `epc_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const db = createServerClient();

  await db
    .prepare(
      `INSERT INTO affiliate_epc_records (
         id, user_id, campaign_id, clicks_7d,
         conversions_7d, gross_revenue_usd, calculated_epc,
         commission_tier, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      recordId,
      user.id,
      params.campaignId,
      params.clicks7d,
      params.conversions7d,
      params.grossRevenueUsd,
      metrics.epcUsd,
      metrics.commissionTier,
      now
    )
    .run();

  await inngest.send({
    name: 'affiliate.deal.matched',
    data: {
      userId: user.id,
      recordId,
      campaignId: params.campaignId,
      calculatedEpc: metrics.epcUsd,
      tier: metrics.commissionTier,
    },
  });

  return {
    success: true as const,
    recordId,
    metrics,
  };
}
