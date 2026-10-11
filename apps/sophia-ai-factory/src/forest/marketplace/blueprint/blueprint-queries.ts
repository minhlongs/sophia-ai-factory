import type {
  MarketplaceFilters,
  PaginatedBlueprints,
  MarketplaceBlueprintItem,
} from '@/seed/types/creator-marketplace';
import { CampaignBlueprintRow, parseAspectRatios } from './types';

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

  let query = 'SELECT * FROM campaign_blueprints WHERE marketplace_listed = 1';
  const params: unknown[] = [];

  if (filters.niche && filters.niche !== 'all') {
    query += ' AND niche = ?';
    params.push(filters.niche);
  }

  if (filters.platform && filters.platform !== 'all') {
    query += ' AND target_platform = ?';
    params.push(filters.platform);
  }

  if (filters.minConversionRate !== undefined) {
    query += ' AND conversion_rate >= ?';
    params.push(filters.minConversionRate);
  }

  if (filters.royaltyRate !== undefined) {
    query += ' AND royalty_pct <= ?';
    params.push(filters.royaltyRate);
  }

  if (filters.search && filters.search.trim()) {
    query += ' AND (title LIKE ? OR hook_style LIKE ?)';
    const term = `%${filters.search.trim()}%`;
    params.push(term, term);
  }

  // Count total matching
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countRes = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countRes?.total ?? 0;

  // Sorting
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

  const items: MarketplaceBlueprintItem[] = (rows.results || []).map((r) => {
    const aspectRatios = parseAspectRatios(r);

    return {
      id: r.id,
      workspaceId: r.workspace_id,
      title: r.title ?? r.name_en ?? 'Video Blueprint',
      hookStyle: r.hook_style,
      targetPlatform: r.target_platform,
      aspectRatios,
      estimatedScenes: r.estimated_scenes ?? 5,
      estimatedDurationSeconds: r.estimated_duration_seconds ?? r.duration_seconds ?? 30,
      estimatedCostCents: r.estimated_cost_cents ?? 50,
      niche: r.niche ?? 'general',
      conversionRate: r.conversion_rate ?? 0.05,
      remixCount: r.remix_count ?? 0,
      royaltyPct: r.royalty_pct ?? 10,
      creatorId: r.creator_id ?? 'creator_anonymous',
      createdAt: r.created_at ?? Date.now(),
    };
  });

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

  const aspectRatios = parseAspectRatios(r);

  return {
    id: r.id,
    workspaceId: r.workspace_id,
    title: r.title ?? r.name_en ?? 'Video Blueprint',
    hookStyle: r.hook_style,
    targetPlatform: r.target_platform,
    aspectRatios,
    estimatedScenes: r.estimated_scenes ?? 5,
    estimatedDurationSeconds: r.estimated_duration_seconds ?? r.duration_seconds ?? 30,
    estimatedCostCents: r.estimated_cost_cents ?? 50,
    niche: r.niche ?? 'general',
    conversionRate: r.conversion_rate ?? 0.05,
    remixCount: r.remix_count ?? 0,
    royaltyPct: r.royalty_pct ?? 10,
    creatorId: r.creator_id ?? 'creator_anonymous',
    createdAt: r.created_at ?? Date.now(),
  };
}
