/**
 * @file smart-link-actions.ts
 * @description Server Actions for Affiliate Smart-Link Yield Optimizer
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { matchBestYieldOffer } from '@/tree/affiliate/smart-link-yield-engine';
import type { AffiliateOffer } from '@/seed/types/growth-triad-v6-types';

export async function optimizeSmartLinkAction(params: {
  videoNiche: string;
  userCountryCode?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const db = createServerClient();
  const rows = await db
    .prepare(
      `SELECT id, name, network, target_url as targetUrl, epc_usd as epcUsd,
              gravity, refund_rate_pct as refundRatePct, commission_pct as commissionPct, niche
       FROM affiliate_smart_offers
       WHERE is_active = ?`
    )
    .bind(1)
    .all<AffiliateOffer>();

  const offers: AffiliateOffer[] = rows.results ?? [];
  const match = matchBestYieldOffer(
    offers,
    params.videoNiche,
    params.userCountryCode ?? 'US'
  );

  if (match) {
    await inngest.send({
      name: 'smartlink.yield.rebalanced',
      data: {
        offerId: match.offerId,
        expectedYieldUsd: match.expectedYieldUsd,
        network: match.fallbackNetwork,
        niche: params.videoNiche,
      },
    });
  }

  return {
    success: true as const,
    match,
  };
}
