/**
 * Playbook Batch Run Actions.
 *
 * Layer: land (business workflows / Server Actions)
 * STRICT 4-LAYER BOUNDARY: imports only from @/seed and @/tree.
 *
 * @module land/playbook/actions/batch-run-actions
 */

'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import type { CampaignBlueprintRow } from '@/seed/types/playbook-pattern';
import { runMissionPreflightCheck, type MissionPreflightResult } from '@/tree/mission/preflight-check';
import { checkMissionQuota } from '@/tree/quota/mission-quota';
import { deductCredits } from '@/tree/mcu/credits-repo';
import type { ActionResult, TriggerBatchParams } from './types';
import { getDbAccess } from './db-access';
import { dispatchBatchMissions } from './batch-dispatch-helper';

function resolveFallbackBlueprint(blueprintId: string, workspaceId: string): CampaignBlueprintRow {
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

export async function triggerBatchRunAction(
  params: TriggerBatchParams,
): Promise<ActionResult<{ batchId: string; missionIds: string[]; preflight: MissionPreflightResult }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { d1, client } = await getDbAccess();
    if (!d1 && !client) {
      return { success: false, error: 'Database not available', code: 'DB_UNAVAILABLE' };
    }

    let blueprint: CampaignBlueprintRow | null = null;
    if (d1) {
      blueprint = await d1
        .prepare(`SELECT * FROM campaign_blueprints WHERE id = ?`)
        .bind(params.blueprintId)
        .first<CampaignBlueprintRow>();
    } else if (client) {
      const res = await client.execute(
        `SELECT * FROM campaign_blueprints WHERE id = ?`,
        [params.blueprintId],
      );
      blueprint = (res.results?.[0] as CampaignBlueprintRow) ?? null;
    }

    if (!blueprint) {
      logger.warn('[triggerBatchRunAction] Blueprint not found in campaign_blueprints, using fallback', {
        blueprintId: params.blueprintId,
      });
      blueprint = resolveFallbackBlueprint(params.blueprintId, params.workspaceId);
    }

    const batchSize = Math.max(1, Math.min(params.batchSize || 1, 20));
    const singleCostCents = blueprint.duration_seconds && blueprint.duration_seconds > 30 ? 150 : 100;
    const totalCostCents = singleCostCents * batchSize;

    const preflight = await runMissionPreflightCheck({
      userId: user.id,
      workspaceId: params.workspaceId,
      capability: 'AI_VIDEO',
      requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
      estimatedCostCents: totalCostCents,
    });

    if (!preflight.passed) {
      logger.warn('[triggerBatchRunAction] 7-Gate preflight failed', {
        failureCode: preflight.failureCode,
        failureReason: preflight.failureReason,
      });
      return {
        success: false,
        error: preflight.failureReason || 'Preflight check failed',
        code: preflight.failureCode || 'PREFLIGHT_FAILED',
        data: { batchId: '', missionIds: [], preflight },
      };
    }

    const userTier = await getUserTier(user.id);
    const quota = await checkMissionQuota(user.id, userTier, 'missions');
    if (!quota.allowed) {
      logger.warn('[triggerBatchRunAction] Monthly quota exceeded', {
        userId: user.id,
        tier: userTier,
        used: quota.used,
        limit: quota.limit,
      });
      return {
        success: false,
        error: `Monthly mission quota exceeded for ${userTier} tier (${quota.used}/${quota.limit})`,
        code: 'QUOTA_EXCEEDED',
        data: { batchId: '', missionIds: [], preflight },
      };
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const creditDeducted = await deductCredits(
      user.id,
      totalCostCents,
      batchId,
      'campaign_batch_dispatch',
    );

    if (!creditDeducted) {
      logger.warn('[triggerBatchRunAction] Credit deduction failed', {
        userId: user.id,
        totalCostCents,
      });
      return {
        success: false,
        error: 'Insufficient MCU credits balance to dispatch batch',
        code: 'INSUFFICIENT_CREDITS',
        data: { batchId, missionIds: [], preflight },
      };
    }

    const missionIds = await dispatchBatchMissions({
      batchId,
      batchSize,
      blueprint,
      blueprintId: params.blueprintId,
      workspaceId: params.workspaceId,
      userId: user.id,
      singleCostCents,
    });

    logger.info('[triggerBatchRunAction] Batch run successfully triggered', {
      batchId,
      missionCount: missionIds.length,
      workspaceId: params.workspaceId,
      blueprintId: params.blueprintId,
    });

    revalidatePath('/dashboard/playbook');
    revalidatePath('/[locale]/dashboard/playbook');
    revalidatePath('/dashboard/missions');
    revalidatePath('/[locale]/dashboard/missions');
    revalidateTag('playbook_runs', 'max');
    revalidateTag('missions', 'max');
    return {
      success: true,
      data: { batchId, missionIds, preflight },
    };
  } catch (err) {
    logger.error(
      '[triggerBatchRunAction] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
      { params },
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to trigger batch campaign run',
      code: 'INTERNAL_ERROR',
    };
  }
}
