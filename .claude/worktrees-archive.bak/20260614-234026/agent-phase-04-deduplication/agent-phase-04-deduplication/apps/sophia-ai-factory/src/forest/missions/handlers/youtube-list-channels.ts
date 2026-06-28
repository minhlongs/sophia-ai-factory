/**
 * Handler: youtube:list-channels
 *
 * Lists all YouTube channels the user has connected via OAuth.
 * Reads from `publishing_channels` WHERE provider='youtube' AND tenant_id=userId.
 *
 * Multi-account aware (P13): one user can connect N YouTube channels, each
 * stored as a separate publishing_channels row keyed by external_account_id.
 *
 * Returns:
 *   - `channels[]` with `{ id, channel_id, title, status, expires_at }`
 *     where `id` is the publishing_channels.id that callers pass back to
 *     `youtube:publish` via `channel_id` param.
 *   - When no channels are connected, returns empty list + upgrade_path string.
 */

import { createServerClient } from '@/seed/db/client';
import type { MissionHandlerResult, MissionContext } from './types';

interface ChannelRow {
  id: string;
  external_account_id: string;
  display_name: string | null;
  status: string;
  expires_at: number | null;
}

interface ListedChannel {
  id: string;
  channel_id: string;
  title: string;
  status: string;
  expires_at: number | null;
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId } = ctx;

  const db = createServerClient();
  const { data } = await db
    .from('publishing_channels')
    .select('id, external_account_id, display_name, status, expires_at')
    .eq('tenant_id', userId)
    .eq('provider', 'youtube') as { data: ChannelRow[] | null; error: unknown };

  const rows = data ?? [];

  if (rows.length === 0) {
    return {
      ok: true,
      data: {
        channels: [],
        total: 0,
        upgrade_path: 'Connect YouTube via Settings > Integrations > YouTube to enable publishing',
      },
    };
  }

  const channels: ListedChannel[] = rows
    .map((r) => ({
      id: r.id,
      channel_id: r.external_account_id,
      title: r.display_name ?? 'YouTube Channel',
      status: r.status,
      expires_at: r.expires_at,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    ok: true,
    data: {
      channels,
      total: channels.length,
    },
  };
}
