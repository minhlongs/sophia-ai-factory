/**
 * Creator Marketplace Single Template & Community Reviews Lookup
 *
 * Layer: tree/marketplace
 *
 * @module tree/marketplace/service/template-detail-query
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CreatorTemplate,
  CreatorTemplateItem,
  CreatorReview,
} from '../types';
import { calculateTrendingRank } from './trending-rank';

/**
 * Retrieves a single template by ID along with its verified community reviews.
 */
export async function getMarketplaceTemplateById(
  db: D1Database | null,
  templateId: string,
): Promise<{ template: CreatorTemplateItem | null; reviews: CreatorReview[] }> {
  if (!db) {
    return { template: null, reviews: [] };
  }
  try {
    const template = await db
      .prepare('SELECT * FROM creator_templates WHERE id = ? LIMIT 1')
      .bind(templateId)
      .first<CreatorTemplate>();

    if (!template) {
      return { template: null, reviews: [] };
    }

    const reviewsRes = await db
      .prepare('SELECT * FROM creator_reviews WHERE template_id = ? ORDER BY created_at DESC LIMIT 50')
      .bind(templateId)
      .all<CreatorReview>();

    const item: CreatorTemplateItem = {
      ...template,
      trendingScore: calculateTrendingRank(
        template.use_count ?? 0,
        template.rating ?? 0,
        template.review_count ?? 0,
        template.created_at ?? Date.now(),
      ),
    };

    return {
      template: item,
      reviews: (reviewsRes.results as CreatorReview[]) || [],
    };
  } catch (err) {
    logger.warn('[marketplace-service] getMarketplaceTemplateById error', { templateId, error: String(err) });
    return { template: null, reviews: [] };
  }
}
