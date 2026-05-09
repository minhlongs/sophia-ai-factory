/**
 * Foundational helper: fetch connected publishing channels for a user.
 * Reads from D1 publishing_channels table.
 * Excludes disconnected/expired rows by default (status = 'active' only).
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

/**
 * Returns all publishing channels for a given user, optionally filtering to
 * only active (status='active') ones.
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

  return (results ?? []).map((r) => ({
    id: r.id,
    provider: r.provider as ChannelProvider,
    display_name: r.display_name,
    status: r.status as ChannelStatus,
  }));
}
