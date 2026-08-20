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

/** All 14 channel providers as a runtime constant for zero-data fill */
const ALL_CHANNELS: readonly ChannelProvider[] = [
  'tiktok', 'youtube', 'instagram', 'pinterest', 'linkedin',
  'zalo', 'facebook', 'twitter', 'threads', 'reddit',
  'bluesky', 'mastodon', 'telegram', 'whatsapp',
] as const;

/** Per-channel aggregated metrics */
export interface ChannelAggregate {
  channel: ChannelProvider;
  events: number;
  revenueCents: number;
  costCents: number;
  roi: number;
  projects: number;
}

/** Full cross-channel dashboard payload */
export interface CrossChannelDashboard {
  workspaceId: string;
  channels: ChannelAggregate[];
  totalEvents: number;
  totalRevenueCents: number;
  totalCostCents: number;
  hasData: boolean;
}

const EMPTY_DASHBOARD: CrossChannelDashboard = {
  workspaceId: '',
  channels: [],
  totalEvents: 0,
  totalRevenueCents: 0,
  totalCostCents: 0,
  hasData: false,
};

type ChannelRow = {
  channel: string;
  events: number;
  revenue_cents: number;
  cost_cents: number;
  roi: number;
  projects: number;
};

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
      .prepare(
        `WITH perf_channels AS (
           SELECT
             pe.channel,
             COUNT(DISTINCT pe.project_id) AS projects,
             SUM(COALESCE(pe.count, 1)) AS events
           FROM performance_events pe
           WHERE pe.workspace_id = ?1
             AND pe.channel IS NOT NULL
           GROUP BY pe.channel
         ),
         roi_channels AS (
           SELECT
             rr.channel,
             SUM(rr.revenue_cents) AS revenue_cents,
             SUM(rr.cost_cents) AS cost_cents,
             CASE
               WHEN SUM(rr.cost_cents) > 0
               THEN ROUND(CAST(SUM(rr.revenue_cents) AS REAL)
                   / CAST(SUM(rr.cost_cents) AS REAL), 2)
               ELSE 0
             END AS roi
           FROM roi_records rr
           WHERE rr.workspace_id = ?1
             AND rr.channel IS NOT NULL
           GROUP BY rr.channel
         )
         SELECT
           COALESCE(pc.channel, rc.channel) AS channel,
           COALESCE(pc.events, 0) AS events,
           COALESCE(pc.projects, 0) AS projects,
           COALESCE(rc.revenue_cents, 0) AS revenue_cents,
           COALESCE(rc.cost_cents, 0) AS cost_cents,
           COALESCE(rc.roi, 0) AS roi
         FROM perf_channels pc
         FULL OUTER JOIN roi_channels rc
           ON pc.channel = rc.channel
         ORDER BY rc.revenue_cents DESC NULLS LAST`
      )
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

    // Fill all 14 channels — channels with no data get zero values
    const channels: ChannelAggregate[] = ALL_CHANNELS.map(ch =>
      channelMap.get(ch) ?? {
        channel: ch,
        events: 0,
        revenueCents: 0,
        costCents: 0,
        roi: 0,
        projects: 0,
      },
    );

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
    // Return 14 zero-filled channels for consistent API response shape
    const channels: ChannelAggregate[] = ALL_CHANNELS.map(ch => ({
      channel: ch,
      events: 0,
      revenueCents: 0,
      costCents: 0,
      roi: 0,
      projects: 0,
    }));
    return { workspaceId, channels, totalEvents: 0, totalRevenueCents: 0, totalCostCents: 0, hasData: false };
  }
}
