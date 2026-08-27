/**
 * Algorithm: create/validate a DistributionPlan for multi-channel publishing.
 *
 * Delivers the Distribution OS promise: one core asset → N channels with
 * idempotent per-channel status tracking. Extends the existing
 * publishing_jobs / publishing_channels infrastructure.
 *
 * The plan:
 *   1. Validates Zod schema (platform array, schedule, asset reference)
 *   2. Persists DistributionPlan via createServerClient() (sync, no await)
 *   3. Creates DistributionPost rows per channel (idempotency key: planId+platform)
 *   4. Returns planId + per-channel postIds for fan-out orchestration
 *
 * Doctrine: customer brings BYOK keys via Setup Wizard; operator stores no tokens.
 *
 * @module land/publish/distribution-plan
 */
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { z } from 'zod/v4';

const SUPPORTED_PLATFORMS = [
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'x',
  'whatsapp',
  'blog',
] as const;

export type Platform = (typeof SUPPORTED_PLATFORMS)[number];

export const DistributionPlanSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  assetId: z.string().min(1),
  channels: z.array(z.enum(SUPPORTED_PLATFORMS)).min(1),
  scheduleAt: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type DistributionPlanInput = z.infer<typeof DistributionPlanSchema>;

export interface DistributionPlanRow {
  id: string;
  workspace_id: string;
  project_id: string;
  asset_id: string;
  channels: string; // JSON array
  schedule_at: number | null;
  status: 'draft' | 'scheduled' | 'executing' | 'completed' | 'failed';
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

export interface DistributionPostRow {
  id: string;
  plan_id: string;
  platform: string;
  platform_post_id: string | null;
  status: 'scheduled' | 'uploading' | 'processing' | 'published' | 'failed';
  scheduled_at: number;
  posted_at: number | null;
  error: string | null;
  idempotency_key: string;
  created_at: number;
}

export class DistributionPlanError extends Error {
  code: 'INVALID_INPUT' | 'ASSET_NOT_FOUND' | 'PLATFORM_UNSUPPORTED' | 'INSERT_FAILED';
  constructor(
    code: 'INVALID_INPUT' | 'ASSET_NOT_FOUND' | 'PLATFORM_UNSUPPORTED' | 'INSERT_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'DistributionPlanError';
    this.code = code;
  }
}

function newPlanId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function newPostId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function buildIdempotencyKey(planId: string, platform: string): string {
  return `dist_${planId}_${platform}`;
}

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

export async function getDistributionPlan(planId: string): Promise<DistributionPlanRow | null> {
  const db = createServerClient();
  return db
    .prepare('SELECT * FROM distribution_plans WHERE id = ?1 LIMIT 1')
    .bind(planId)
    .first<DistributionPlanRow>();
}

export async function getDistributionPosts(planId: string): Promise<DistributionPostRow[]> {
  const db = createServerClient();
  const result = await db
    .prepare('SELECT * FROM distribution_posts WHERE plan_id = ?1 ORDER BY created_at')
    .bind(planId)
    .all<DistributionPostRow>();
  return result.results;
}

export async function updateDistributionPostStatus(
  postId: string,
  status: DistributionPostRow['status'],
  platformPostId?: string,
  error?: string,
): Promise<void> {
  const db = createServerClient();
  const nowSec = Math.floor(Date.now() / 1000);

  if (platformPostId && error) {
    await db
      .prepare(
        `UPDATE distribution_posts
         SET status = ?1, platform_post_id = ?2, error = ?3, posted_at = ?4
         WHERE id = ?5`,
      )
      .bind(status, platformPostId, error, status === 'published' ? nowSec : null, postId)
      .run();
  } else if (platformPostId) {
    await db
      .prepare(
        `UPDATE distribution_posts
         SET status = ?1, platform_post_id = ?2, posted_at = ?3
         WHERE id = ?4`,
      )
      .bind(status, platformPostId, status === 'published' ? nowSec : null, postId)
      .run();
  } else if (error) {
    await db
      .prepare(
        `UPDATE distribution_posts
         SET status = ?1, error = ?2
         WHERE id = ?3`,
      )
      .bind(status, error, postId)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE distribution_posts
         SET status = ?1
         WHERE id = ?2`,
      )
      .bind(status, postId)
      .run();
  }
}