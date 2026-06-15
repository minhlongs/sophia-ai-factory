import { createServerClient, getD1Raw } from '@/seed/db/client';
import { getHeyGenKey } from '@/tree/credentials/get-provider-key';
import { createHeyGenVideo } from '@/land/video/heygen-helpers';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from './types';
import { getOrDefault } from '@/seed/tenant-settings/registry';
import type { StorageSettings } from '@/seed/tenant-settings/defaults';
import { openclaw } from '@/land/openclaw';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const script = (params?.script as string) ?? 'Hello, this is your AI avatar video.';
  const title = (params?.title as string) ?? 'AI Video';

  const rawDb = await getD1Raw();
  const db = createServerClient();

  // 1. Check storage settings for R2 BYOS and local CheetahClaws rendering
  const storageSettings = await getOrDefault<StorageSettings>(rawDb, userId, 'storage');

  const videoId = crypto.randomUUID();

  if (storageSettings?.useTenantStorage && storageSettings.r2AccessKeyId) {
    logger.info('[video:create] Routing video generation to local CheetahClaws engine', { userId, videoId });

    // Insert video row in queued state
    await db.from('videos').insert({
      id: videoId,
      user_id: userId,
      title,
      script,
      status: 'queued',
      source: 'mission',
    });

    try {
      const mcpResult = (await openclaw.mcp(
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
        }
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

  // 2. Fallback to HeyGen legacy execution path
  const keyResult = await getHeyGenKey({ userId, fallbackToPlatform: false });
  if (!keyResult) {
    return {
      ok: false,
      error: 'HeyGen API key not configured. Add it in Settings > Integrations.',
    };
  }

  // Insert video row in queued state
  await db.from('videos').insert({
    id: videoId,
    user_id: userId,
    title,
    script,
    status: 'queued',
    source: 'mission',
  });

  try {
    const result = await createHeyGenVideo({
      apiKey: keyResult.key,
      script,
      title,
    });

    await db
      .from('videos')
      .update({ status: 'processing', heygen_job_id: result.videoId })
      .eq('id', videoId);

    return {
      ok: true,
      data: {
        videoId,
        video_id: videoId,
        heygen_job_id: result.videoId,
        heygen_video_id: result.videoId,
        status: 'processing',
        title,
      },
    };
  } catch (err) {
    logger.error('[video:create] HeyGen error', err instanceof Error ? err : new Error(String(err)));
    await db.from('videos').update({ status: 'failed' }).eq('id', videoId);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'HeyGen video creation failed',
    };
  }
}
