/**
 * Cross-Channel Resolver Types, SQL & Mapping Helpers
 * Layer: forest (analytics queries)
 *
 * @module forest/analytics/queries/cross-channel-resolver-helpers
 */

import type { ChannelProvider } from '@/seed/types/channel-provider';

/** All 14 channel providers as a runtime constant for zero-data fill */
export const ALL_CHANNELS: readonly ChannelProvider[] = [
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

export const EMPTY_DASHBOARD: CrossChannelDashboard = {
  workspaceId: '',
  channels: [],
  totalEvents: 0,
  totalRevenueCents: 0,
  totalCostCents: 0,
  hasData: false,
};

export type ChannelRow = {
  channel: string;
  events: number;
  revenue_cents: number;
  cost_cents: number;
  roi: number;
  projects: number;
};

export const CROSS_CHANNEL_SQL = `WITH perf_channels AS (
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
 ORDER BY rc.revenue_cents DESC NULLS LAST`;

export function buildZeroFilledChannels(
  channelMap?: Map<string, ChannelAggregate>,
): ChannelAggregate[] {
  return ALL_CHANNELS.map(
    (ch) =>
      channelMap?.get(ch) ?? {
        channel: ch,
        events: 0,
        revenueCents: 0,
        costCents: 0,
        roi: 0,
        projects: 0,
      },
  );
}
