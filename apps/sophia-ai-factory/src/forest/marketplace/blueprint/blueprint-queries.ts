import type {
  MarketplaceFilters,
  PaginatedBlueprints,
  MarketplaceBlueprintItem,
} from '@/seed/types/creator-marketplace';
import type { CampaignBlueprintRow } from './types';
import {
  mapBlueprintRowToItem,
  buildBlueprintFilterSql,
} from './blueprint-row-mapper';

/**
 * Retrieves paginated, filtered blueprints for the Marketplace catalog.
 */
export async function listMarketplaceBlueprints(
  db: D1Database | null,
  filters: MarketplaceFilters,
): Promise<PaginatedBlueprints> {
  const page = filters.page !== undefined ? (filters.page <= 0 ? 1 : filters.page) : 1;
  const pageSize = Math.max(1, Math.min(50, filters.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  if (!db) {
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const { query: baseQuery, params } = buildBlueprintFilterSql(filters);
  let query = baseQuery;

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countRes = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countRes?.total ?? 0;

  let orderBy = 'conversion_rate DESC, remix_count DESC';
  if (filters.sort === 'most_remixed') {
    orderBy = 'remix_count DESC, conversion_rate DESC';
  } else if (filters.sort === 'highest_conversion') {
    orderBy = 'conversion_rate DESC, remix_count DESC';
  } else if (filters.sort === 'newest') {
    orderBy = 'created_at DESC';
  }

  query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const rows = await db.prepare(query).bind(...params).all<CampaignBlueprintRow>();
  const items: MarketplaceBlueprintItem[] = (rows.results || []).map(mapBlueprintRowToItem);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

/**
 * Fetches a single blueprint by ID for pre-population in Studio Wizard.
 */
export async function getBlueprintById(
  db: D1Database,
  blueprintId: string,
): Promise<MarketplaceBlueprintItem | null> {
  const r = await db
    .prepare('SELECT * FROM campaign_blueprints WHERE id = ?')
    .bind(blueprintId)
    .first<CampaignBlueprintRow>();

  if (!r) return null;

  return mapBlueprintRowToItem(r);
}
