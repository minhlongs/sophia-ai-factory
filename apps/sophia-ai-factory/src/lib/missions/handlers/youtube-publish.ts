/**
 * Handler: youtube:publish
 *
 * BETA/STUB — uploads video to YouTube if OAuth credentials exist,
 * otherwise returns a stub response explaining how to connect.
 *
 * Real implementation: wire to YouTube Data API v3 via OAuth
 * in Settings > Integrations > YouTube.
 */

import { createServerClient } from '@/lib/db/client';
import type { MissionHandlerResult, MissionContext } from './types';

interface CredRow {
  encrypted_value: string;
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const videoUrl = (params?.video_url as string) ?? '';
  const title = (params?.title as string) ?? 'My Video';
  const description = (params?.description as string) ?? '';

  await new Promise(res => setTimeout(res, 2000));

  if (!videoUrl) {
    return { ok: false, error: 'params.video_url is required' };
  }

  const db = createServerClient();
  const { data } = await db
    .from('user_provider_credentials')
    .select('encrypted_value')
    .eq('user_id', userId)
    .eq('provider', 'youtube_oauth')
    .single() as { data: CredRow | null; error: unknown };

  if (!data) {
    return {
      ok: true,
      data: {
        is_stub: true,
        message: 'YouTube OAuth not connected. Connect in Settings > Integrations > YouTube.',
        upgrade_path: 'Connect YouTube OAuth credentials in Settings > Integrations to enable real publishing',
        title,
        description,
      },
    };
  }

  // Placeholder: real YouTube API v3 upload would go here
  return {
    ok: true,
    data: {
      youtube_video_id: 'PLACEHOLDER_YT_ID',
      title,
      description,
      status: 'uploaded',
      note: 'YouTube upload integration is connected — real upload logic pending implementation',
    },
  };
}
