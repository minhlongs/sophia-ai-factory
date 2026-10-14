import type {
  RoiRow,
  ContentProjectRoi,
  WorkspaceContentRoi,
} from './types';

export function aggregateRoiRows(
  rows: RoiRow[],
  workspaceId: string,
): WorkspaceContentRoi {
  const projectMap = new Map<string, ContentProjectRoi>();
  let totalRevenue = 0;
  let totalCost = 0;

  for (const row of rows) {
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
  const workspaceRoi =
    totalCost > 0 ? Math.round((totalRevenue / totalCost) * 100) / 100 : 0;

  return {
    workspaceId,
    projects,
    totalRevenueCents: totalRevenue,
    totalCostCents: totalCost,
    roi: workspaceRoi,
    hasData,
  };
}
