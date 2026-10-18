/**
 * Playbook Batch Run Helpers (Blueprint Resolution & Cache Revalidation).
 *
 * Layer: land (business workflows)
 * STRICT 4-LAYER BOUNDARY: imports only from @/seed and @/tree.
 *
 * @module land/playbook/actions/batch-run-helpers
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { getUserTier } from '@/seed/db/get-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import type { CampaignBlueprintRow } from '@/seed/types/playbook-pattern';
import { checkMissionQuota } from '@/tree/quota/mission-quota';
import { getDbAccess } from './db-access';

export function resolveFallbackBlueprint(
  blueprintId: string,
  workspaceId: string,
): CampaignBlueprintRow {
  return {
    id: blueprintId,
    workspace_id: workspaceId,
    name_en: 'Batch Campaign',
    name_vi: 'Chiến dịch Batch',
    description_en: 'Automated batch run',
    description_vi: 'Chạy loạt tự động',
    target_platform: 'youtube_shorts',
    hook_style: 'curiosity_gap',
    voice_style: 'dynamic_hook',
    duration_seconds: 60,
    aspect_ratio: '9:16',
    estimated_scenes: 3,
    suggested_prompts: '[]',
    is_active: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

export async function loadOrFallbackBlueprint(
  blueprintId: string,
  workspaceId: string,
): Promise<{ blueprint: CampaignBlueprintRow | null; dbAvailable: boolean }> {
  const { d1, client } = await getDbAccess();
  if (!d1 && !client) {
    return { blueprint: null, dbAvailable: false };
  }

  let blueprint: CampaignBlueprintRow | null = null;
  if (d1) {
    blueprint = await d1
      .prepare(`SELECT * FROM campaign_blueprints WHERE id = ?`)
      .bind(blueprintId)
      .first<CampaignBlueprintRow>();
  } else if (client) {
    const res = await client.execute(
      `SELECT * FROM campaign_blueprints WHERE id = ?`,
      [blueprintId],
    );
    blueprint = (res.results?.[0] as CampaignBlueprintRow) ?? null;
  }

  if (!blueprint) {
    logger.warn('[triggerBatchRunAction] Blueprint not found in campaign_blueprints, using fallback', {
      blueprintId,
    });
    blueprint = resolveFallbackBlueprint(blueprintId, workspaceId);
  }

  return { blueprint, dbAvailable: true };
}

export function revalidateBatchRunPaths(): void {
  revalidatePath('/dashboard/playbook');
  revalidatePath('/[locale]/dashboard/playbook');
  revalidatePath('/dashboard/missions');
  revalidatePath('/[locale]/dashboard/missions');
  revalidateTag('playbook_runs', 'max');
  revalidateTag('missions', 'max');
}

export async function verifyBatchMissionQuota(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userTier = await getUserTier(userId);
  const quota = await checkMissionQuota(userId, userTier, 'missions');
  if (!quota.allowed) {
    logger.warn('[triggerBatchRunAction] Monthly quota exceeded', {
      userId,
      tier: userTier,
      used: quota.used,
      limit: quota.limit,
    });
    return {
      ok: false,
      error: `Monthly mission quota exceeded for ${userTier} tier (${quota.used}/${quota.limit})`,
    };
  }
  return { ok: true };
}
