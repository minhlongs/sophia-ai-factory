/**
 * Cross-Channel Resolver — aggregates performance + ROI per ChannelProvider.
 * Covers all 14 channels from seed/types/channel-provider.ts.
 * Handles zero-data gracefully (returns hasData: false).
 * Layer: forest (analytics queries — read-only D1 SELECTs)
 *
 * @module forest/analytics/queries/cross-channel-resolver
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { ChannelProvider } from '@/seed/types/channel-provider';
import {
  ALL_CHANNELS,
  EMPTY_DASHBOARD,
  CROSS_CHANNEL_SQL,
  buildZeroFilledChannels,
  type ChannelAggregate,
  type CrossChannelDashboard,
  type ChannelRow,
} from './cross-channel-resolver-helpers';

export { ALL_CHANNELS, EMPTY_DASHBOARD, CROSS_CHANNEL_SQL, buildZeroFilledChannels };
export type { ChannelAggregate, CrossChannelDashboard, ChannelRow };

/**
 * Aggregate performance and ROI metrics per ChannelProvider.
 * Returns zero-data sentinel when tables are empty — never throws.
 */
export async function resolveCrossChannel(
  workspaceId: string,
): Promise<CrossChannelDashboard> {
  if (!workspaceId) return { ...EMPTY_DASHBOARD, workspaceId };

  const db = await getD1();
  if (!db) {
    logger.warn('[CrossChannelResolver] D1 unavailable');
    return { ...EMPTY_DASHBOARD, workspaceId };
  }

  try {
    const { results } = await db
      .prepare(CROSS_CHANNEL_SQL)
      .bind(workspaceId)
      .all<ChannelRow>();

    const channelMap = new Map<string, ChannelAggregate>();
    for (const row of results ?? []) {
      const ch = row.channel as ChannelProvider;
      channelMap.set(ch, {
        channel: ch,
        events: row.events,
        revenueCents: row.revenue_cents,
        costCents: row.cost_cents,
        roi: row.roi,
        projects: row.projects,
      });
    }

    const channels = buildZeroFilledChannels(channelMap);
    const totalEvents = channels.reduce((s, c) => s + c.events, 0);
    const totalRevenue = channels.reduce((s, c) => s + c.revenueCents, 0);
    const totalCost = channels.reduce((s, c) => s + c.costCents, 0);
    const hasData = totalEvents > 0 || totalRevenue > 0;

    return {
      workspaceId,
      channels,
      totalEvents,
      totalRevenueCents: totalRevenue,
      totalCostCents: totalCost,
      hasData,
    };
  } catch (err) {
    logger.error('[CrossChannelResolver] Query failed', { error: String(err) });
    const channels = buildZeroFilledChannels();
    return {
      workspaceId,
      channels,
      totalEvents: 0,
      totalRevenueCents: 0,
      totalCostCents: 0,
      hasData: false,
    };
  }
}
