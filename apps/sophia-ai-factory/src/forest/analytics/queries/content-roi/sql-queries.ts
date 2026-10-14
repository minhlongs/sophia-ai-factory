export const CONTENT_ROI_QUERY = `
WITH project_roi AS (
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
ORDER BY pr.revenue_cents DESC, pr.title ASC
`.trim();
