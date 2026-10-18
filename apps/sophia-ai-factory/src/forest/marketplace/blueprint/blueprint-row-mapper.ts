import type {
  MarketplaceFilters,
  MarketplaceBlueprintItem,
} from '@/seed/types/creator-marketplace';
import { type CampaignBlueprintRow, parseAspectRatios } from './types';

export function mapBlueprintRowToItem(r: CampaignBlueprintRow): MarketplaceBlueprintItem {
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

export function buildBlueprintFilterSql(filters: MarketplaceFilters): {
  query: string;
  params: unknown[];
} {
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

  return { query, params };
}
