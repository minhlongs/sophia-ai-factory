/**
 * @file attribution-actions.ts
 * @description Server Actions for Omnichannel Multi-Touch Attribution & Dynamic Tier Splitter
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  calculateAttributionWeights,
  calculateLtvCacRatio,
  type RawTouchpoint,
} from '@/tree/attribution/multitouch-attribution';
import type { AttributionModel } from '@/seed/types/growth-triad-v3-types';

export async function calculateOmnichannelAttributionAction(params: {
  conversionId: string;
  totalGmv: number;
  customerLifetimeValue: number;
  acquisitionCost: number;
  attributionModel: AttributionModel;
  rawTouchpoints: RawTouchpoint[];
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  const weights = calculateAttributionWeights(
    params.rawTouchpoints,
    params.totalGmv,
    params.attributionModel
  );

  const ltvCacRatio = calculateLtvCacRatio(
    params.customerLifetimeValue,
    params.acquisitionCost
  );

  const db = createServerClient();
  const now = Date.now();

  for (const item of weights) {
    const touchpointId = `tp_${params.conversionId}_${item.channel}_${now}`;
    await db
      .prepare(
        `INSERT INTO omnichannel_touchpoints (
           id, user_id, conversion_id, channel_source,
           weight_percentage, attributed_gmv, ltv_cac_ratio,
           payout_status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        touchpointId,
        user.id,
        params.conversionId,
        item.channel,
        item.weightPercentage,
        item.attributedGmv,
        ltvCacRatio,
        'CALCULATED',
        now
      )
      .run();
  }

  await inngest.send({
    name: 'omnichannel.attribution.calculated',
    data: {
      conversionId: params.conversionId,
      userId: user.id,
      model: params.attributionModel,
      totalAttributedGmv: params.totalGmv,
      touchpointCount: weights.length,
    },
  });

  return {
    success: true,
    conversionId: params.conversionId,
    weights,
    ltvCacRatio,
  };
}
