/**
 * Creator Marketplace Template Catalog Discovery & Read Queries
 *
 * Layer: tree/marketplace
 *
 * @module tree/marketplace/service/template-query
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CreatorTemplate,
  CreatorTemplateItem,
  TemplateQueryFilter,
  PaginatedTemplates,
} from '../types';
import {
  calculateTrendingRank,
  buildTemplateFilterConditions,
  resolveSqlOrderBy,
} from './trending-rank';

export { getMarketplaceTemplateById } from './template-detail-query';

/**
 * Lists creator templates with filtering, search, and dynamic sorting (including trending decay).
 */
export async function listMarketplaceTemplates(
  db: D1Database | null,
  filter?: TemplateQueryFilter,
  nowMs = Date.now(),
): Promise<PaginatedTemplates> {
  const page = Math.max(1, filter?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter?.pageSize ?? 12));

  if (!db) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  const offset = (page - 1) * pageSize;
  const { conditions, params } = buildTemplateFilterConditions(filter);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  let total = 0;
  try {
    const countRow = await db
      .prepare(`SELECT COUNT(*) AS total FROM creator_templates ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();
    total = countRow?.total ?? 0;
  } catch (err) {
    logger.warn('[marketplace-service] Count query error, fallback to 0', { error: String(err) });
  }

  const sortBy = filter?.sortBy ?? 'trending';
  const sqlOrderBy = resolveSqlOrderBy(sortBy);

  const queryLimit = sortBy === 'trending' ? Math.max(100, page * pageSize) : pageSize;
  const queryOffset = sortBy === 'trending' ? 0 : offset;

  let rows: CreatorTemplate[] = [];
  try {
    const res = await db
      .prepare(
        `SELECT * FROM creator_templates
         ${whereClause}
         ORDER BY ${sqlOrderBy}
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, queryLimit, queryOffset)
      .all<CreatorTemplate>();
    rows = (res.results as CreatorTemplate[]) || [];
  } catch (err) {
    logger.warn('[marketplace-service] Query creator_templates error', { error: String(err) });
  }

  const itemsWithTrending: CreatorTemplateItem[] = rows.map((row) => ({
    ...row,
    trendingScore: calculateTrendingRank(
      row.use_count ?? 0,
      row.rating ?? 0,
      row.review_count ?? 0,
      row.created_at ?? nowMs,
      nowMs,
    ),
  }));

  let finalItems: CreatorTemplateItem[];
  if (sortBy === 'trending') {
    itemsWithTrending.sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0));
    finalItems = itemsWithTrending.slice(offset, offset + pageSize);
  } else {
    finalItems = itemsWithTrending;
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    items: finalItems,
    total,
    page,
    pageSize,
    totalPages,
  };
}
