/**
 * Creator Marketplace Trending Rank and Query Filter Builders
 *
 * Layer: tree/marketplace
 *
 * @module tree/marketplace/service/trending-rank
 */

import type { TemplateQueryFilter, TemplateSortOrder } from '../types';

/**
 * Calculates trending rank score with engagement velocity and time decay.
 *
 * Invariant:
 * Adding 2.0 hours to the denominator ensures well-behaved bounded values
 * at t = 0 and prevents division by zero.
 */
export function calculateTrendingRank(
  useCount: number,
  rating: number,
  reviewCount: number,
  createdAtMs: number,
  nowMs = Date.now(),
): number {
  const hoursSinceCreated = Math.max(0, (nowMs - createdAtMs) / (1000 * 60 * 60));
  const numerator = useCount * 3.0 + rating * reviewCount * 2.0;
  const denominator = Math.pow(hoursSinceCreated + 2.0, 1.3);

  const rawScore = numerator / denominator;
  return Math.round(rawScore * 1000) / 1000;
}

export function buildTemplateFilterConditions(filter?: TemplateQueryFilter): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Filter: status (default to 'approved' for public marketplace browsing)
  if (filter?.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  } else {
    conditions.push("status = 'approved'");
  }

  // Filter: niche
  if (filter?.niche && filter.niche !== 'all') {
    conditions.push('niche = ?');
    params.push(filter.niche);
  }

  // Filter: platform
  if (filter?.targetPlatform && filter.targetPlatform !== 'all') {
    conditions.push('target_platform = ?');
    params.push(filter.targetPlatform);
  }

  // Filter: price range
  if (filter?.minPriceCents !== undefined) {
    conditions.push('price_cents >= ?');
    params.push(filter.minPriceCents);
  }
  if (filter?.maxPriceCents !== undefined) {
    conditions.push('price_cents <= ?');
    params.push(filter.maxPriceCents);
  }

  // Filter: search text
  if (filter?.search && filter.search.trim().length > 0) {
    const term = `%${filter.search.trim()}%`;
    conditions.push('(title LIKE ? OR description LIKE ? OR niche LIKE ?)');
    params.push(term, term, term);
  }

  return { conditions, params };
}

export function resolveSqlOrderBy(sortBy?: TemplateSortOrder): string {
  switch (sortBy) {
    case 'top_rated':
      return 'rating DESC, review_count DESC';
    case 'most_used':
      return 'use_count DESC, rating DESC';
    case 'newest':
      return 'created_at DESC';
    case 'price_asc':
      return 'price_cents ASC';
    case 'price_desc':
      return 'price_cents DESC';
    default:
      return 'created_at DESC';
  }
}
