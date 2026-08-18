/**
 * Revenue Attribution — unified join across content → affiliate → conversion → payment.
 * Aggregates clicks, conversions, revenue, cost by content_project + channel.
 * Layer: forest (analytics queries — read-only D1 SELECTs)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface RevenueAttributionRow {
  workspaceId: string;
  contentProjectId: string;
  contentAssetId: string | null;
  channel: string;
  network: string;
  clicks: number;
  conversions: number;
  revenueCents: number;
  costCents: number;
  roi: number;
  attributedAt: number;
}
/** Per-content-project attribution row (unit-level ROI) */
export interface ContentUnitAttribution {
  contentProjectId: string;
  workspaceId: string;
  title: string;
  channel: string;
  clicks: number;
  conversions: number;
  revenueCents: number;
  costCents: number;
  roi: number;
  events: number;
}

const EMPTY: RevenueAttributionRow[] = [];
const EMPTY_UNIT: ContentUnitAttribution[] = [];

/**
 * Aggregate revenue attribution per content project + channel for a workspace.
 * Returns empty array on any error (including D1 unavailability) — never throws.
 */
export async function aggregateRevenueAttribution(
  workspaceId: string,
  opts?: { since?: number },
): Promise<RevenueAttributionRow[]> {
  const db = getD1();
  if (!db) {
    logger.warn('[RevenueAttribution] D1 unavailable — returning empty result');
    return EMPTY;
  }

  try {
    const sinceParam = opts?.since ?? 0;
    const sql = `
      WITH click_counts AS (
        SELECT al.user_id AS creator_id, COUNT(ce.id) AS clicks,
               COALESCE(aof.network_id, 'unknown') AS network
        FROM affiliate_links al
        LEFT JOIN click_events ce ON ce.link_id = al.id
        LEFT JOIN affiliate_offers aof ON aof.id = ce.offer_id
        GROUP BY al.user_id, COALESCE(aof.network_id, 'unknown')
      ),
      conversion_counts AS (
        SELECT al.user_id AS creator_id, COUNT(cv.id) AS conversions,
               COALESCE(SUM(cv.gross_amount_usd), 0) * 100 AS revenue_cents,
               COALESCE(SUM(cv.commission_usd), 0) * 100 AS cost_cents,
               COALESCE(aof2.network_id, 'unknown') AS network
        FROM affiliate_links al
        LEFT JOIN conversion_events cv ON cv.link_id = al.id
        LEFT JOIN affiliate_offers aof2 ON aof2.id = cv.offer_id
        GROUP BY al.user_id, COALESCE(aof2.network_id, 'unknown')
      ),
      legacy_clicks AS (
        SELECT ac.user_id AS creator_id, COUNT(ac.id) AS clicks,
               COALESCE(ac.network, 'unknown') AS network
        FROM affiliate_clicks ac
        GROUP BY ac.user_id, COALESCE(ac.network, 'unknown')
      ),
      payment_revenue AS (
        SELECT cp.creator_id,
               COALESCE(SUM(CAST(JSON_EXTRACT(pe.payload, '$.pay_amount') AS REAL)), 0) * 100 AS revenue_cents
        FROM content_projects cp
        LEFT JOIN payment_events pe ON pe.processed = 1
        WHERE cp.workspace_id = ?1 AND cp.created_at >= ?2
        GROUP BY cp.creator_id
      ),
      asset_click_counts AS (
        SELECT ca.project_id AS content_project_id, ca.id AS content_asset_id,
               COALESCE(SUM(cc.clicks), 0) + COALESCE(SUM(lc.clicks), 0) AS clicks,
               COALESCE(MAX(cc.network), MAX(lc.network), 'unknown') AS network
        FROM content_assets ca
        LEFT JOIN click_counts cc ON cc.creator_id = (
          SELECT cp2.creator_id FROM content_projects cp2 WHERE cp2.id = ca.project_id
        )
        LEFT JOIN legacy_clicks lc ON lc.creator_id = (
          SELECT cp3.creator_id FROM content_projects cp3 WHERE cp3.id = ca.project_id
        )
        GROUP BY ca.project_id, ca.id
      ),
      asset_conv_counts AS (
        SELECT ca.project_id AS content_project_id, ca.id AS content_asset_id,
               COALESCE(SUM(cvc.conversions), 0) AS conversions,
               COALESCE(SUM(cvc.revenue_cents), 0) AS revenue_cents,
               COALESCE(SUM(cvc.cost_cents), 0) AS cost_cents,
               COALESCE(MAX(cvc.network), 'unknown') AS network
        FROM content_assets ca
        LEFT JOIN conversion_counts cvc ON cvc.creator_id = (
          SELECT cp2.creator_id FROM content_projects cp2 WHERE cp2.id = ca.project_id
        )
        GROUP BY ca.project_id, ca.id
      )
      SELECT cp.id AS content_project_id, cp.workspace_id, ca.id AS content_asset_id,
             COALESCE(ac.network, acv.network, 'direct') AS channel,
             COALESCE(ac.network, acv.network, 'unknown') AS network,
             COALESCE(ac.clicks, 0) AS clicks,
             COALESCE(acv.conversions, 0) AS conversions,
             COALESCE(acv.revenue_cents, 0) + COALESCE(pr.revenue_cents, 0) AS revenue_cents,
             COALESCE(acv.cost_cents, 0) AS cost_cents,
             cp.created_at AS attributed_at
      FROM content_projects cp
      LEFT JOIN content_assets ca ON ca.project_id = cp.id AND ca.workspace_id = cp.workspace_id
      LEFT JOIN asset_click_counts ac ON ac.content_project_id = cp.id AND ac.content_asset_id = ca.id
      LEFT JOIN asset_conv_counts acv ON acv.content_project_id = cp.id AND acv.content_asset_id = ca.id
      LEFT JOIN payment_revenue pr ON pr.creator_id = cp.creator_id
      WHERE cp.workspace_id = ?1 AND cp.created_at >= ?2
      GROUP BY cp.id, cp.workspace_id, ca.id, cp.created_at
    `;

    const { results } = await db.prepare(sql).bind(workspaceId, sinceParam).all<{
      content_project_id: string;
      workspace_id: string;
      content_asset_id: string | null;
      channel: string;
      network: string;
      clicks: number;
      conversions: number;
      revenue_cents: number;
      cost_cents: number;
      attributed_at: number;
    }>();

    return (results ?? []).map((row) => {
      const rev = row.revenue_cents ?? 0;
      const cost = row.cost_cents ?? 0;
      const roi = cost > 0 ? ((rev - cost) / cost) * 100 : rev > 0 ? 100 : 0;
      return {
        workspaceId: row.workspace_id,
        contentProjectId: row.content_project_id,
        contentAssetId: row.content_asset_id,
        channel: row.channel ?? 'direct',
        network: row.network ?? 'unknown',
        clicks: row.clicks ?? 0,
        conversions: row.conversions ?? 0,
        revenueCents: rev,
        costCents: cost,
        roi,
        attributedAt: row.attributed_at ?? 0,
      };
    });
  } catch (err) {
    logger.error('[RevenueAttribution] Query failed', { error: String(err) });
    return EMPTY;
  }
}

/**
 * getContentUnitAttribution — per-ContentProject ROI CTE.
 *
 * Extends the existing 6-CTE resolver by adding a unit-level attribution query
 * that joins content_projects + roi_records + performance_events.
 * Returns empty array on zero-data or D1 unavailability — never throws.
 */
type UnitRow = {
  content_project_id: string;
  workspace_id: string;
  title: string;
  channel: string;
  clicks: number;
  conversions: number;
  revenue_cents: number;
  cost_cents: number;
  roi: number;
  events: number;
};

export async function getContentUnitAttribution(
  workspaceId: string,
): Promise<ContentUnitAttribution[]> {
  if (!workspaceId) return EMPTY_UNIT;

  const db = getD1();
  if (!db) {
    logger.warn('[RevenueAttribution] D1 unavailable for unit attribution');
    return EMPTY_UNIT;
  }

  try {
    const { results } = await db
      .prepare(
        `WITH unit_roi AS (
           SELECT
             cp.id AS content_project_id,
             cp.workspace_id,
             cp.title,
             COALESCE(SUM(rr.revenue_cents), 0) AS revenue_cents,
             COALESCE(SUM(rr.cost_cents), 0) AS cost_cents,
             rr.channel,
             COUNT(*) AS events
           FROM content_projects cp
           LEFT JOIN roi_records rr
             ON rr.entity_type = 'content_project'
            AND rr.entity_id = cp.id
            AND rr.workspace_id = cp.workspace_id
           WHERE cp.workspace_id = ?1
           GROUP BY cp.id, rr.channel
         )
         SELECT
           content_project_id,
           workspace_id,
           title,
           channel,
           0 AS clicks,
           0 AS conversions,
           revenue_cents,
           cost_cents,
           CASE
             WHEN cost_cents > 0
             THEN ROUND(
               CAST(revenue_cents - cost_cents AS REAL)
               / CAST(cost_cents AS REAL), 2)
             ELSE 0
           END AS roi,
           events
         FROM unit_roi
         ORDER BY revenue_cents DESC, title ASC`
      )
      .bind(workspaceId)
      .all<UnitRow>();

    return (results ?? []).map(row => ({
      contentProjectId: row.content_project_id,
      workspaceId: row.workspace_id,
      title: row.title,
      channel: row.channel ?? 'direct',
      clicks: row.clicks,
      conversions: row.conversions,
      revenueCents: row.revenue_cents,
      costCents: row.cost_cents,
      roi: row.roi,
      events: row.events,
    }));
  } catch (err) {
    logger.error('[RevenueAttribution] Unit attribution failed', { error: String(err) });
    return EMPTY_UNIT;
  }
}