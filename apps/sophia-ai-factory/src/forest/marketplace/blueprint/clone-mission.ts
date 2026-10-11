import type {
  CloneBlueprintResult,
} from '@/seed/types/creator-marketplace';
import { estimateBlueprintStudioCost } from '@/tree/marketplace/preflight-cost-engine';
import { CampaignBlueprintRow } from './types';

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
