/**
 * Blueprint Service — Marketplace Discovery & Studio Cloning
 *
 * Layer: forest (orchestration, database operations, transactional mutations)
 * Dependencies: @/seed/types/creator-marketplace, @/tree/marketplace/preflight-cost-engine
 *
 * @module forest/marketplace/blueprint-service
 */

import type {
  MarketplaceFilters,
  PaginatedBlueprints,
  MarketplaceBlueprintItem,
  CloneBlueprintResult,
} from '@/seed/types/creator-marketplace';
import { estimateBlueprintStudioCost } from '@/tree/marketplace/preflight-cost-engine';

interface CampaignBlueprintRow {
  id: string;
  workspace_id: string;
  title?: string;
  name_en?: string;
  name_vi?: string;
  description?: string;
  description_en?: string;
  description_vi?: string;
  hook_style: string;
  target_platform: string;
  aspect_ratios?: string;
  aspect_ratio?: string;
  estimated_scenes?: number;
  estimated_duration_seconds?: number;
  duration_seconds?: number;
  estimated_cost_cents?: number;
  niche?: string;
  conversion_rate?: number;
  remix_count?: number;
  royalty_pct?: number;
  creator_id?: string;
  parent_blueprint_id?: string;
  created_at?: number;
}

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
    let aspectRatios = ['9:16'];
    if (r.aspect_ratios) {
      try {
        aspectRatios = JSON.parse(r.aspect_ratios);
      } catch {
        aspectRatios = [r.aspect_ratios];
      }
    } else if (r.aspect_ratio) {
      aspectRatios = [r.aspect_ratio];
    }

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
 * Clones a marketplace blueprint into a new draft creative mission in Creative Studio.
 * Enforces spike cost protection ($5.00) and atomically increments remix_count.
 */
export async function cloneBlueprintForMission(
  db: D1Database,
  blueprintId: string,
  userId: string,
  workspaceId: string,
  nowMs = Date.now(),
): Promise<CloneBlueprintResult> {
  if (!blueprintId || blueprintId.trim().length === 0) {
    return {
      success: false,
      blueprintId: '',
      preflightCostCents: 0,
      error: 'BLUEPRINT_NOT_FOUND',
    };
  }

  const bp = await db
    .prepare('SELECT * FROM campaign_blueprints WHERE id = ?')
    .bind(blueprintId)
    .first<CampaignBlueprintRow>();

  if (!bp) {
    return {
      success: false,
      blueprintId,
      preflightCostCents: 0,
      error: 'BLUEPRINT_NOT_FOUND',
    };
  }

  const scenes = bp.estimated_scenes ?? 5;
  const duration = bp.estimated_duration_seconds ?? bp.duration_seconds ?? 30;
  const preflight = estimateBlueprintStudioCost(scenes, duration, 3);

  if (preflight.isCeilingExceeded) {
    return {
      success: false,
      blueprintId,
      preflightCostCents: preflight.totalCostCents,
      error: 'COST_SPIKE_CEILING_EXCEEDED',
    };
  }

  const missionId = `mis_${crypto.randomUUID().replace(/-/g, '').slice(0, 9)}_${nowMs}`;
  const title = `Cloned: ${bp.title ?? bp.name_en ?? 'Video Blueprint'}`;

  try {
    await db
      .prepare(
        `INSERT INTO creative_missions (
          id, workspace_id, creator_id, title, status, budget_cents, blueprint_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      )
      .bind(
        missionId,
        workspaceId,
        userId,
        title,
        preflight.totalCostCents,
        blueprintId,
        nowMs,
        nowMs,
      )
      .run();
  } catch {
    // Fallback if updated_at is omitted in older schemas
    await db
      .prepare(
        `INSERT INTO creative_missions (
          id, workspace_id, creator_id, title, status, budget_cents, blueprint_id, created_at
        ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`,
      )
      .bind(
        missionId,
        workspaceId,
        userId,
        title,
        preflight.totalCostCents,
        blueprintId,
        nowMs,
      )
      .run();
  }

  // Atomically increment remix_count on the blueprint
  await db
    .prepare('UPDATE campaign_blueprints SET remix_count = remix_count + 1 WHERE id = ?')
    .bind(blueprintId)
    .run();

  return {
    success: true,
    missionId,
    blueprintId,
    preflightCostCents: preflight.totalCostCents,
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

  let aspectRatios = ['9:16'];
  if (r.aspect_ratios) {
    try {
      aspectRatios = JSON.parse(r.aspect_ratios);
    } catch {
      aspectRatios = [r.aspect_ratios];
    }
  } else if (r.aspect_ratio) {
    aspectRatios = [r.aspect_ratio];
  }

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
