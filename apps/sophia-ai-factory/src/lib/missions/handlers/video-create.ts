/**
 * Handler: video:create
 *
 * Creates an AI avatar video via HeyGen using the user's own API key.
 * Inserts a videos row and calls HeyGen createVideo.
 *
 * LIVE — requires HeyGen API key in user_provider_credentials.
 */

import { createServerClient } from '@/seed/db/client';
import { getHeyGenKey } from '@/lib/credentials/get-provider-key';
import { createHeyGenVideo } from '@/lib/video/heygen-helpers';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from './types';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const script = (params?.script as string) ?? 'Hello, this is your AI avatar video.';
  const title = (params?.title as string) ?? 'AI Video';

  const keyResult = await getHeyGenKey({ userId, fallbackToPlatform: false });
  if (!keyResult) {
    return {
      ok: false,
      error: 'HeyGen API key not configured. Add it in Settings > Integrations.',
    };
  }

  const db = createServerClient();

  // Insert video row in queued state
  const videoId = crypto.randomUUID();
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
      .update({ status: 'processing', heygen_video_id: result.videoId })
      .eq('id', videoId);

    return {
      ok: true,
      data: {
        video_id: videoId,
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
