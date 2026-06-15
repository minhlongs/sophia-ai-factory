/**
 * Handler: video:status
 *
 * Returns status of a video by id from the videos table.
 * LIVE — no external API call needed.
 */

import { createServerClient } from '@/seed/db/client';
import type { MissionHandlerResult, MissionContext } from './types';

interface VideoRow {
  id: string;
  title: string;
  status: string;
  heygen_job_id: string | null;
  video_url: string | null;
  created_at: string;
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const videoId = params?.video_id as string | undefined;

  if (!videoId) {
    return { ok: false, error: 'params.video_id is required' };
  }

  const db = createServerClient();
  const { data } = await db
    .from('videos')
    .select('id, title, status, heygen_job_id, video_url, created_at')
    .eq('id', videoId)
    .eq('user_id', userId)
    .single() as { data: VideoRow | null; error: unknown };

  if (!data) {
    return { ok: false, error: 'Video not found or access denied' };
  }

  return {
    ok: true,
    data: {
      video_id: data.id,
      title: data.title,
      status: data.status,
      heygen_job_id: data.heygen_job_id,
      heygen_video_id: data.heygen_job_id,
      video_url: data.video_url,
      created_at: data.created_at,
    },
  };
}
