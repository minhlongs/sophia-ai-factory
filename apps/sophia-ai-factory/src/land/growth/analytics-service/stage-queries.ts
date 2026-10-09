/**
 * Cloudflare D1 Stage Counts Query Aggregator
 *
 * Layer: Land (Domain service & data aggregation, imports seed only)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module land/growth/analytics-service/stage-queries
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface StageCountsResult {
  totalVisitors: number;
  totalLeads: number;
  totalTrials: number;
  totalPaid: number;
  tierCounts: { basic: number; premium: number; enterprise: number; master: number };
}

export async function fetchStageCounts(
  db: D1Database,
  windowStartMs: number,
): Promise<StageCountsResult> {
  let totalVisitors = 0;
  try {
    const viralLinksStmt = db.prepare(
      'SELECT COALESCE(SUM(clicks_count), 0) as total_clicks, COALESCE(SUM(views_count), 0) as total_views FROM viral_funnel_links WHERE created_at >= ?',
    );
    const viralRes = await viralLinksStmt.bind(windowStartMs).first<{ total_clicks: number; total_views: number }>();
    const viralClicks = viralRes?.total_clicks ?? 0;
    const viralViews = viralRes?.total_views ?? 0;

    const clickEventsStmt = db.prepare('SELECT COUNT(*) as cnt FROM click_events WHERE clicked_at >= ?');
    const clickRes = await clickEventsStmt.bind(Math.floor(windowStartMs / 1000)).first<{ cnt: number }>();
    const rawClicks = clickRes?.cnt ?? 0;

    totalVisitors = Math.max(viralClicks + rawClicks, Math.floor(viralViews * 0.05));
  } catch {
    // Non-fatal if table not yet populated
  }

  let totalLeads = 0;
  try {
    const growthLeadsStmt = db.prepare('SELECT COUNT(*) as cnt FROM growth_leads WHERE created_at >= ?');
    const gRes = await growthLeadsStmt.bind(windowStartMs).first<{ cnt: number }>();
    const growthLeadsCount = gRes?.cnt ?? 0;

    const tgLeadsStmt = db.prepare('SELECT COUNT(*) as cnt FROM telegram_leads WHERE created_at >= ?');
    const tgRes = await tgLeadsStmt.bind(windowStartMs).first<{ cnt: number }>();
    const telegramLeadsCount = tgRes?.cnt ?? 0;

    totalLeads = growthLeadsCount + telegramLeadsCount;
  } catch {
    // Non-fatal
  }

  let totalTrials = 0;
  try {
    const growthDemoStmt = db.prepare(
      "SELECT COUNT(*) as cnt FROM growth_leads WHERE status IN ('demo_sent', 'checkout_opened', 'converted') AND created_at >= ?",
    );
    const gdRes = await growthDemoStmt.bind(windowStartMs).first<{ cnt: number }>();
    const growthDemos = gdRes?.cnt ?? 0;

    const tgDemoStmt = db.prepare(
      "SELECT COUNT(*) as cnt FROM telegram_leads WHERE (status IN ('demo_sent', 'checkout_sent', 'converted') OR demo_video_sent_at IS NOT NULL) AND created_at >= ?",
    );
    const tgDemosRes = await tgDemoStmt.bind(windowStartMs).first<{ cnt: number }>();
    const tgDemos = tgDemosRes?.cnt ?? 0;

    const videosStmt = db.prepare('SELECT COUNT(*) as cnt FROM videos WHERE created_at >= ?');
    const vRes = await videosStmt.bind(Math.floor(windowStartMs / 1000)).first<{ cnt: number }>();
    const videosCreated = vRes?.cnt ?? 0;

    totalTrials = growthDemos + tgDemos + videosCreated;
  } catch {
    // Non-fatal
  }

  const tierCounts = { basic: 0, premium: 0, enterprise: 0, master: 0 };
  let totalPaid = 0;
  try {
    const licStmt = db.prepare(
      'SELECT tier, COUNT(*) as cnt FROM raas_licenses WHERE is_revoked = 0 GROUP BY tier',
    );
    const licRows = await licStmt.all<{ tier: string; cnt: number }>();
    if (licRows.results) {
      for (const row of licRows.results) {
        const t = (row.tier || '').toUpperCase();
        if (t === 'BASIC') tierCounts.basic += row.cnt;
        else if (t === 'PREMIUM') tierCounts.premium += row.cnt;
        else if (t === 'ENTERPRISE') tierCounts.enterprise += row.cnt;
        else if (t === 'MASTER') tierCounts.master += row.cnt;
      }
    }
    totalPaid = tierCounts.basic + tierCounts.premium + tierCounts.enterprise + tierCounts.master;
  } catch {
    // Non-fatal
  }

  return { totalVisitors, totalLeads, totalTrials, totalPaid, tierCounts };
}
