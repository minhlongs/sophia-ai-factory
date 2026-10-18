import type { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult } from '@/forest/missions/types';
import type { StorageSettings } from '@/seed/tenant-settings/defaults';

export type McpInvokeFn = (
  server: string,
  tool: string,
  args: Record<string, unknown>,
  options: { ctx: { tenantId: string }; db: D1Database },
) => Promise<unknown>;

export interface LocalVideoCreateParams {
  db: ReturnType<typeof createServerClient>;
  rawDb: D1Database;
  userId: string;
  videoId: string;
  title: string;
  script: string;
  storageSettings: StorageSettings;
  mcpInvoke: McpInvokeFn;
}

export async function renderViaCheetahClaws({
  db,
  rawDb,
  userId,
  videoId,
  title,
  script,
  storageSettings,
  mcpInvoke,
}: LocalVideoCreateParams): Promise<MissionHandlerResult> {
  logger.info('[video:create] Routing video generation to local CheetahClaws engine', { userId, videoId });

  await db.from('videos').insert({
    id: videoId,
    user_id: userId,
    title,
    script,
    status: 'queued',
    source: 'mission',
  });

  try {
    const mcpResult = (await mcpInvoke(
      'cheetahclaws',
      'renderVideo',
      {
        jobId: videoId,
        script,
        title,
        userId,
        storage: {
          accessKeyId: storageSettings.r2AccessKeyId,
          secretAccessKey: storageSettings.r2SecretAccessKey,
          bucketName: storageSettings.r2BucketName,
          endpoint: storageSettings.r2Endpoint,
          publicBaseUrl: storageSettings.r2PublicBaseUrl,
        },
      },
      {
        ctx: { tenantId: userId },
        db: rawDb,
      },
    )) as Record<string, unknown>;

    await db
      .from('videos')
      .update({ status: 'processing', heygen_job_id: `local_${videoId}` })
      .eq('id', videoId);

    return {
      ok: true,
      data: {
        videoId,
        video_id: videoId,
        heygen_job_id: `local_${videoId}`,
        status: 'processing',
        title,
        local_render: true,
        output: mcpResult,
      },
    };
  } catch (err) {
    logger.error('[video:create] CheetahClaws rendering error', err instanceof Error ? err : new Error(String(err)));
    await db.from('videos').update({ status: 'failed' }).eq('id', videoId);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'CheetahClaws rendering failed',
    };
  }
}
