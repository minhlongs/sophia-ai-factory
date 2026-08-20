/**
 * Content Unit ROI Resolver — joins content_projects + roi_records + performance_events.
 * Computes ROI per ContentProject (tree/content-graph) with zero-data handling.
 * Layer: forest (analytics queries — read-only D1 SELECTs)
 *
 * @module forest/analytics/queries/content-roi-resolver
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/** Per-channel ROI breakdown within a single ContentProject */
export interface ChannelRoi {
  channel: string;
  revenueCents: number;
  costCents: number;
  roi: number;
  events: number;
}

/** Complete ROI snapshot for one ContentProject */
export interface ContentProjectRoi {
  workspaceId: string;
  contentProjectId: string;
  title: string;
  budgetCents: number;
  totalRevenueCents: number;
  totalCostCents: number;
  roi: number;
  events: number;
  channels: ChannelRoi[];
  hasData: boolean;
}

/** Workspace-level aggregated ROI across all ContentProjects */
export interface WorkspaceContentRoi {
  workspaceId: string;
  projects: ContentProjectRoi[];
  totalRevenueCents: number;
  totalCostCents: number;
  roi: number;
  hasData: boolean;
}

const EMPTY_WORKSPACE: WorkspaceContentRoi = {
  workspaceId: '',
  projects: [],
  totalRevenueCents: 0,
  totalCostCents: 0,
  roi: 0,
  hasData: false,
};

type RoiRow = {
  content_project_id: string;
  title: string;
  budget_cents: number;
  revenue_cents: number;
  cost_cents: number;
  roi: number;
  events: number;
  channel: string;
  workspace_id: string;
  ch_revenue: number | null;
  ch_cost: number | null;
  ch_roi: number | null;
  ch_events: number | null;
};

/**
 * Resolve ROI for every ContentProject in a workspace.
 * Returns zero-data sentinel (hasData: false) when roi_records is empty
 * or D1 is unavailable — never throws.
 */
export async function resolveContentRoi(
  workspaceId: string,
): Promise<WorkspaceContentRoi> {
  if (!workspaceId) return { ...EMPTY_WORKSPACE, workspaceId };

  const db = await getD1();
  if (!db) {
    logger.warn('[ContentRoiResolver] D1 unavailable');
    return { ...EMPTY_WORKSPACE, workspaceId };
  }

  try {
    const { results } = await db
      .prepare(
        `WITH project_roi AS (
           SELECT
             cp.id AS content_project_id,
             cp.title,
             cp.budget_cents,
             COALESCE(SUM(rr.revenue_cents), 0) AS revenue_cents,
             COALESCE(SUM(rr.cost_cents), 0) AS cost_cents,
             CASE
               WHEN COALESCE(SUM(rr.cost_cents), 0) > 0
               THEN ROUND(CAST(SUM(rr.revenue_cents) AS REAL)
                   / CAST(SUM(rr.cost_cents) AS REAL), 2)
               ELSE 0
             END AS roi,
             cp.workspace_id
           FROM content_projects cp
           LEFT JOIN roi_records rr
             ON rr.entity_type = 'content_project'
            AND rr.entity_id = cp.id
            AND rr.workspace_id = cp.workspace_id
           WHERE cp.workspace_id = ?1
           GROUP BY cp.id
         ),
         project_events AS (
           SELECT
             pe.project_id,
             COUNT(*) AS events
           FROM performance_events pe
           WHERE pe.workspace_id = ?1
             AND pe.entity_type = 'content_project'
           GROUP BY pe.project_id
         ),
         channel_breakdown AS (
           SELECT
             rr.entity_id AS content_project_id,
             rr.channel,
             SUM(rr.revenue_cents) AS revenue_cents,
             SUM(rr.cost_cents) AS cost_cents,
             CASE
               WHEN SUM(rr.cost_cents) > 0
               THEN ROUND(CAST(SUM(rr.revenue_cents) AS REAL)
                   / CAST(SUM(rr.cost_cents) AS REAL), 2)
               ELSE 0
             END AS roi,
             COUNT(*) AS events
           FROM roi_records rr
           WHERE rr.workspace_id = ?1
             AND rr.entity_type = 'content_project'
           GROUP BY rr.entity_id, rr.channel
         )
         SELECT
           pr.content_project_id,
           pr.title,
           pr.budget_cents,
           pr.revenue_cents,
           pr.cost_cents,
           pr.roi,
           pr.workspace_id,
           COALESCE(pe.events, 0) AS events,
           cb.channel,
           cb.revenue_cents AS ch_revenue,
           cb.cost_cents AS ch_cost,
           cb.roi AS ch_roi,
           cb.events AS ch_events
         FROM project_roi pr
         LEFT JOIN project_events pe ON pe.project_id = pr.content_project_id
         LEFT JOIN channel_breakdown cb ON cb.content_project_id = pr.content_project_id
         ORDER BY pr.revenue_cents DESC, pr.title ASC`
      )
      .bind(workspaceId)
      .all<RoiRow>();

    const projectMap = new Map<string, ContentProjectRoi>();
    let totalRevenue = 0;
    let totalCost = 0;

    for (const row of results ?? []) {
      let proj = projectMap.get(row.content_project_id);
      if (!proj) {
        proj = {
          workspaceId: row.workspace_id,
          contentProjectId: row.content_project_id,
          title: row.title,
          budgetCents: row.budget_cents,
          totalRevenueCents: row.revenue_cents,
          totalCostCents: row.cost_cents,
          roi: row.roi,
          events: row.events,
          channels: [],
          hasData: row.revenue_cents > 0 || row.events > 0,
        };
        projectMap.set(row.content_project_id, proj);
        totalRevenue += row.revenue_cents;
        totalCost += row.cost_cents;
      }

      if (row.channel) {
        proj.channels.push({
          channel: row.channel,
          revenueCents: row.ch_revenue ?? 0,
          costCents: row.ch_cost ?? 0,
          roi: row.ch_roi ?? 0,
          events: row.ch_events ?? 0,
        });
      }
    }

    const projects = Array.from(projectMap.values());
    const hasData = projects.some(p => p.hasData);
    const workspaceRoi = totalCost > 0
      ? Math.round((totalRevenue / totalCost) * 100) / 100
      : 0;

    return {
      workspaceId,
      projects,
      totalRevenueCents: totalRevenue,
      totalCostCents: totalCost,
      roi: workspaceRoi,
      hasData,
    };
  } catch (err) {
    logger.error('[ContentRoiResolver] Query failed', { error: String(err) });
    return { ...EMPTY_WORKSPACE, workspaceId };
  }
}
