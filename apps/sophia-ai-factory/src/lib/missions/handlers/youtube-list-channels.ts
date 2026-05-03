/**
 * Handler: youtube:list-channels
 *
 * BETA/STUB — lists YouTube channels if OAuth is connected.
 * Real implementation: wire to YouTube Data API v3 channels.list endpoint.
 */

import { createServerClient } from '@/lib/db/client';
import type { MissionHandlerResult, MissionContext } from './types';

interface CredRow {
  encrypted_value: string;
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId } = ctx;

  await new Promise(res => setTimeout(res, 2000));

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
        channels: [],
        total: 0,
        is_stub: true,
        upgrade_path: 'Connect YouTube OAuth credentials in Settings > Integrations to list your channels',
      },
    };
  }

  return {
    ok: true,
    data: {
      channels: [{ id: 'PLACEHOLDER_CHANNEL_ID', title: 'My Channel', subscriber_count: 0 }],
      total: 1,
      note: 'YouTube OAuth connected — real channel list pending full implementation',
    },
  };
}
