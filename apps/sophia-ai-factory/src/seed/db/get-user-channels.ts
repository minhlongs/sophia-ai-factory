/**
 * Foundational helper: fetch connected publishing channels for a user.
 * Reads from D1 publishing_channels table + telegram_paired_chats.
 * Excludes disconnected/expired rows by default (status = 'active' only).
 *
 * Telegram note: Telegram pairings live in telegram_paired_chats (not
 * publishing_channels). We append a synthetic UserChannel entry per pairing
 * so callers (DistributePanel, distribute route) see Telegram alongside OAuth channels.
 * The synthetic id = telegram_paired_chats.chat_id (used as channel_id surrogate
 * in publishing_jobs — D1/SQLite has no FK enforcement).
 *
 * @module seed/db/get-user-channels
 */

import type { ChannelProvider, ChannelStatus } from '@/lib/publishing/publisher-interface';

export interface UserChannel {
  id: string;
  provider: ChannelProvider;
  display_name: string | null;
  status: ChannelStatus;
}

type D1Row = { id: string; provider: string; display_name: string | null; status: string };
type TelegramPairingRow = { chat_id: string; first_name: string | null };

/**
 * Returns all publishing channels for a given user, optionally filtering to
 * only active (status='active') ones. Appends Telegram pairings from
 * telegram_paired_chats WHERE paired_by = userId.
 *
 * @param db - Raw D1Database binding (available via __env.DB in edge runtime)
 * @param userId - Current user's id (tenant_id = user.id convention)
 * @param onlyActive - When true (default) skip disconnected/expired channels
 */
export async function getUserChannels(
  db: D1Database,
  userId: string,
  onlyActive = true,
): Promise<UserChannel[]> {
  const query = onlyActive
    ? `SELECT id, provider, display_name, status
       FROM publishing_channels
       WHERE user_id = ? AND status = 'active'
       ORDER BY provider ASC`
    : `SELECT id, provider, display_name, status
       FROM publishing_channels
       WHERE user_id = ?
       ORDER BY provider ASC`;

  const { results } = await db
    .prepare(query)
    .bind(userId)
    .all<D1Row>();

  const channels: UserChannel[] = (results ?? []).map((r) => ({
    id: r.id,
    provider: r.provider as ChannelProvider,
    display_name: r.display_name,
    status: r.status as ChannelStatus,
  }));

  // Append Telegram pairings (paired_by = userId is the user who paired their DM/channel)
  const { results: telegramRows } = await db
    .prepare(`SELECT chat_id, first_name FROM telegram_paired_chats WHERE paired_by = ?`)
    .bind(userId)
    .all<TelegramPairingRow>();

  for (const row of (telegramRows ?? [])) {
    channels.push({
      // chat_id used as surrogate channel_id in publishing_jobs (no FK enforcement in D1)
      id: row.chat_id,
      provider: 'telegram',
      // Display name: first_name from pairing record, fallback to 'Telegram'
      display_name: row.first_name ?? 'Telegram',
      status: 'active',
    });
  }

  return channels;
}
