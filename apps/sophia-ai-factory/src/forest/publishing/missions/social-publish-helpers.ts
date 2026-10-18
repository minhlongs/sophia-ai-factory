/**
 * Helpers for social:publish mission handler
 *
 * Provider normalization, caption assembly, and connected channel discovery.
 */

import type { ChannelProvider } from '@/forest/publishing/publisher-interface';

export const PROVIDERS: ChannelProvider[] = [
  'tiktok', 'youtube', 'instagram', 'pinterest', 'linkedin', 'zalo',
  'facebook', 'twitter', 'threads', 'reddit', 'bluesky', 'mastodon', 'telegram',
];

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function normalizeProvider(value: string): ChannelProvider | null {
  const normalized = value === 'x' ? 'twitter' : value === 'youtube_shorts' ? 'youtube' : value;
  return PROVIDERS.includes(normalized as ChannelProvider) ? (normalized as ChannelProvider) : null;
}

export function normalizeCaption(params: Record<string, unknown>): string | undefined {
  const caption = asString(params.caption, asString(params.tweet, asString(params.title)));
  const hashtags = params.hashtags;
  if (!caption && !hashtags) return undefined;
  if (Array.isArray(hashtags)) return `${caption} ${hashtags.map(String).join(' ')}`.trim();
  if (typeof hashtags === 'string') return `${caption} ${hashtags}`.trim();
  return caption || undefined;
}

export async function listConnectedChannels(
  db: D1Database,
  userId: string,
  requestedProvider: ChannelProvider | 'all_connected',
): Promise<{ provider: ChannelProvider; channelId: string }[]> {
  const channels: { provider: ChannelProvider; channelId: string }[] = [];
  const oauthProviders = requestedProvider === 'all_connected'
    ? PROVIDERS.filter((p) => p !== 'telegram')
    : requestedProvider === 'telegram'
      ? []
      : [requestedProvider];

  if (oauthProviders.length > 0) {
    const placeholders = oauthProviders.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `SELECT id, provider FROM publishing_channels
         WHERE user_id = ? AND provider IN (${placeholders}) AND status = 'active'
         ORDER BY provider ASC`,
      )
      .bind(userId, ...oauthProviders)
      .all<{ id: string; provider: string }>();

    for (const row of results ?? []) {
      const provider = normalizeProvider(row.provider);
      if (provider) channels.push({ provider, channelId: row.id });
    }
  }

  if (requestedProvider === 'all_connected' || requestedProvider === 'telegram') {
    const tgRow = await db
      .prepare(`SELECT chat_id FROM telegram_paired_chats WHERE paired_by = ? LIMIT 1`)
      .bind(userId)
      .first<{ chat_id: string }>();
    if (tgRow?.chat_id) channels.push({ provider: 'telegram', channelId: tgRow.chat_id });
  }

  return channels;
}
