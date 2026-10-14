/**
 * Experiment Store - Row Mapper
 *
 * Layer: forest/ab
 */

import type { AbExperiment, AbExperimentRow } from '../ab-types';

export function rowToExperiment(row: AbExperimentRow): AbExperiment {
  return {
    id: row.id,
    videoId: row.video_id,
    tenantId: row.tenant_id,
    contentType: row.content_type ?? 'thumbnail',
    variantACaption: row.variant_a_caption,
    variantBCaption: row.variant_b_caption,
    variantAThumbUrl: row.variant_a_thumb_url,
    variantBThumbUrl: row.variant_b_thumb_url,
    impressionsA: row.impressions_a,
    impressionsB: row.impressions_b,
    conversionsA: row.conversions_a,
    conversionsB: row.conversions_b,
    winner: row.winner,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    offerId: row.offer_id,
    bundleId: row.bundle_id,
  };
}
