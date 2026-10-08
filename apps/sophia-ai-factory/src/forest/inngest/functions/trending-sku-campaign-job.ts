/**
 * @file trending-sku-campaign-job.ts
 * @description Inngest background job for 1-Click Viral Campaign generation from trending SKU
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';

export const trendingSkuCampaignJob = inngest.createFunction(
  {
    id: 'trending-sku-campaign-job',
    name: 'SKU Radar: 1-Click Viral Campaign Auto-Generation',
    concurrency: { limit: 5 },
  },
  { event: 'trending.sku.detected' },
  async ({ event, step }) => {
    const { skuId, skuCode, productName, platform, suggestedHook } = event.data;

    // Step 1: Create or update trending radar item
    await step.run('upsert-radar-item', async () => {
      const db = createServerClient();
      await db.execute(
        `UPDATE trending_sku_radar_items
         SET top_selling_hook_summary = ?,
             updated_at = ?
         WHERE id = ?`,
        [suggestedHook, Date.now(), skuId],
      );
    });

    // Step 2: Auto-generate Bridge Page slug
    const bridgePageSlug = await step.run('generate-bridge-page-slug', async () => {
      const cleanName = productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      return `deal-${skuCode.toLowerCase()}-${cleanName.slice(0, 24)}`;
    });

    return {
      skuId,
      skuCode,
      platform,
      bridgePageSlug,
      status: 'CAMPAIGN_ASSETS_STAGED',
    };
  },
);
