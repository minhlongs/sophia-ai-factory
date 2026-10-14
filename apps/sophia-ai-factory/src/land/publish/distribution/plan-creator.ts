import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  DistributionPlanInput,
  DistributionPlanSchema,
  DistributionPlanError,
  newPlanId,
  newPostId,
  buildIdempotencyKey,
} from './types';

export async function createDistributionPlan(
  input: DistributionPlanInput,
): Promise<{ planId: string; posts: { platform: string; postId: string; idempotencyKey: string }[] }> {
  const parsed = DistributionPlanSchema.safeParse(input);
  if (!parsed.success) {
    throw new DistributionPlanError('INVALID_INPUT', parsed.error.message);
  }
  const data = parsed.data;

  // Validate asset exists
  const db = createServerClient();
  const asset = await db
    .prepare('SELECT id FROM video_assets WHERE id = ?1 AND workspace_id = ?2 LIMIT 1')
    .bind(data.assetId, data.workspaceId)
    .first<{ id: string }>();

  if (!asset) {
    throw new DistributionPlanError('ASSET_NOT_FOUND', `Asset ${data.assetId} not found in workspace ${data.workspaceId}`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const planId = newPlanId();

  // Insert DistributionPlan
  try {
    await db
      .prepare(
        `INSERT INTO distribution_plans (
           id, workspace_id, project_id, asset_id, channels,
           schedule_at, status, metadata, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'scheduled', ?7, ?8, ?8)`,
      )
      .bind(
        planId,
        data.workspaceId,
        data.projectId,
        data.assetId,
        JSON.stringify(data.channels),
        data.scheduleAt ?? nowSec,
        data.metadata ? JSON.stringify(data.metadata) : null,
        nowSec,
      )
      .run();
  } catch (err) {
    logger.error('[distribution-plan] insert plan failed', toError(err), { planId, workspaceId: data.workspaceId });
    throw new DistributionPlanError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  // Insert DistributionPost rows (one per channel) with idempotency keys
  const posts: { platform: string; postId: string; idempotencyKey: string }[] = [];
  const scheduleAt = data.scheduleAt ?? nowSec;

  for (const platform of data.channels) {
    const postId = newPostId();
    const idempotencyKey = buildIdempotencyKey(planId, platform);

    try {
      await db
        .prepare(
          `INSERT INTO distribution_posts (
             id, plan_id, platform, platform_post_id, status,
             scheduled_at, posted_at, error, idempotency_key, created_at
           ) VALUES (?1, ?2, ?3, NULL, 'scheduled', ?4, NULL, NULL, ?5, ?6)
           ON CONFLICT(idempotency_key) DO NOTHING`,
        )
        .bind(postId, planId, platform, scheduleAt, idempotencyKey, nowSec)
        .run();

      posts.push({ platform, postId, idempotencyKey });
    } catch (err) {
      logger.error('[distribution-plan] insert post failed', toError(err), { planId, platform });
      throw new DistributionPlanError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
    }
  }

  logger.info('[distribution-plan] Created', { planId, workspaceId: data.workspaceId, channelCount: posts.length });
  return { planId, posts };
}
