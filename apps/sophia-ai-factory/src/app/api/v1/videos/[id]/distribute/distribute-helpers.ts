/**
 * Channel resolution and validation helpers for POST /api/v1/videos/[id]/distribute
 *
 * @module app/api/v1/videos/[id]/distribute/distribute-helpers
 */

import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';
import type { ChannelProvider } from '@/forest/publishing/publisher-interface';

export const CHANNEL_PROVIDERS: [ChannelProvider, ...ChannelProvider[]] = [
  'tiktok', 'youtube', 'instagram', 'pinterest', 'linkedin', 'zalo',
  'facebook', 'twitter', 'threads', 'reddit', 'bluesky', 'mastodon', 'telegram',
];

export const distributeSchema = z.object({
  channelProviders: z.array(z.enum(CHANNEL_PROVIDERS)).min(1).max(CHANNEL_PROVIDERS.length),
  caption: z.string().max(2200).optional(),
  /** Unix epoch seconds; clamped to [now, now+30days] */
  scheduledAt: z.number().int().positive().optional(),
});

export type DistributeInput = z.infer<typeof distributeSchema>;

export function clampDistributeScheduleTime(scheduledAt?: number): number {
  const now = Math.floor(Date.now() / 1000);
  const maxScheduled = now + 30 * 24 * 3600;
  return scheduledAt ? Math.min(Math.max(scheduledAt, now), maxScheduled) : now;
}

export async function resolveConnectedChannels(
  db: D1Database,
  userId: string,
  channelProviders: ChannelProvider[],
): Promise<{ channelMap: Map<string, string>; missingProviders: ChannelProvider[] }> {
  const oauthProviders = channelProviders.filter((p) => p !== 'telegram');
  const hasTelegram = channelProviders.includes('telegram');
  const channelMap = new Map<string, string>();

  if (oauthProviders.length > 0) {
    const placeholders = oauthProviders.map(() => '?').join(',');
    const { results: channelRows } = await db
      .prepare(
        `SELECT id, provider FROM publishing_channels
         WHERE user_id = ? AND provider IN (${placeholders}) AND status = 'active'
         ORDER BY provider ASC`,
      )
      .bind(userId, ...oauthProviders)
      .all<{ id: string; provider: string }>();

    for (const r of channelRows ?? []) {
      channelMap.set(r.provider, r.id);
    }
  }

  if (hasTelegram) {
    const tgRow = await db
      .prepare(`SELECT chat_id FROM telegram_paired_chats WHERE paired_by = ? LIMIT 1`)
      .bind(userId)
      .first<{ chat_id: string }>();

    if (!tgRow) {
      return { channelMap, missingProviders: ['telegram'] };
    }
    channelMap.set('telegram', tgRow.chat_id);
  }

  const missingProviders = channelProviders.filter((p) => !channelMap.has(p));
  return { channelMap, missingProviders };
}
