/**
 * Sub-queries for Viral Funnel Links, Telegram Bot Leads, and Affiliate Clicks.
 * @module land/growth/analytics-service/channel-sub-queries
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface ViralFunnelSummary {
  viralLinksViews: number;
  viralLinksClicks: number;
  viralLinksLeads: number;
  viralLinksConversions: number;
}

export async function queryViralFunnelSummary(
  db: D1Database,
  windowStartMs: number,
): Promise<ViralFunnelSummary> {
  const defaults: ViralFunnelSummary = {
    viralLinksViews: 0,
    viralLinksClicks: 0,
    viralLinksLeads: 0,
    viralLinksConversions: 0,
  };
  try {
    const viralSummaryStmt = db.prepare(`
      SELECT
        COALESCE(SUM(views_count), 0) as total_views,
        COALESCE(SUM(clicks_count), 0) as total_clicks,
        COALESCE(SUM(leads_count), 0) as total_leads,
        COALESCE(SUM(conversions_count), 0) as total_conversions
      FROM viral_funnel_links
      WHERE created_at >= ?
    `);
    const vSummary = await viralSummaryStmt.bind(windowStartMs).first<{
      total_views: number;
      total_clicks: number;
      total_leads: number;
      total_conversions: number;
    }>();
    if (vSummary) {
      return {
        viralLinksViews: vSummary.total_views || 0,
        viralLinksClicks: vSummary.total_clicks || 0,
        viralLinksLeads: vSummary.total_leads || 0,
        viralLinksConversions: vSummary.total_conversions || 0,
      };
    }
  } catch {
    // Non-fatal
  }
  return defaults;
}

export interface TelegramBotStats {
  tgBotLeads: number;
  tgBotTrials: number;
  tgBotPaid: number;
}

export async function queryTelegramBotStats(
  db: D1Database,
  windowStartMs: number,
): Promise<TelegramBotStats> {
  try {
    const tgStatsStmt = db.prepare(`
      SELECT
        COUNT(*) as cnt,
        SUM(CASE WHEN (status IN ('demo_sent', 'checkout_sent', 'converted') OR demo_video_sent_at IS NOT NULL) THEN 1 ELSE 0 END) as trials_cnt,
        SUM(CASE WHEN (status = 'paid' OR is_paid = 1) THEN 1 ELSE 0 END) as paid_cnt
      FROM telegram_leads
      WHERE created_at >= ?
    `);
    const tgRes = await tgStatsStmt
      .bind(windowStartMs)
      .first<{ cnt: number; trials_cnt: number; paid_cnt: number }>();
    if (tgRes) {
      return {
        tgBotLeads: tgRes.cnt || 0,
        tgBotTrials: tgRes.trials_cnt || 0,
        tgBotPaid: tgRes.paid_cnt || 0,
      };
    }
  } catch {
    // Non-fatal
  }
  return { tgBotLeads: 0, tgBotTrials: 0, tgBotPaid: 0 };
}

export async function queryAffiliateReferralClicks(
  db: D1Database,
  windowStartMs: number,
): Promise<number> {
  try {
    const affClicksStmt = db.prepare(
      'SELECT COUNT(*) as cnt FROM affiliate_referral_clicks WHERE created_at >= ?',
    );
    const affRes = await affClicksStmt.bind(windowStartMs).first<{ cnt: number }>();
    return affRes?.cnt || 0;
  } catch {
    // Non-fatal
    return 0;
  }
}
