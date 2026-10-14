/**
 * Cloudflare D1 Channel Attribution & Leads Query Aggregator
 *
 * Layer: Land (Domain service & data aggregation, imports seed only)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module land/growth/analytics-service/channel-queries
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { RawChannelAttributionData } from './types';

export { fetchRecentLeads } from './recent-leads-query';

export async function fetchChannelAttributionData(
  db: D1Database,
  windowStartMs: number,
): Promise<RawChannelAttributionData[]> {
  const sourceStats: Record<string, { leads: number; trials: number; paid: number }> = {
    viral_video: { leads: 0, trials: 0, paid: 0 },
    telegram_bot: { leads: 0, trials: 0, paid: 0 },
    seo_landing: { leads: 0, trials: 0, paid: 0 },
    affiliate: { leads: 0, trials: 0, paid: 0 },
    direct: { leads: 0, trials: 0, paid: 0 },
  };

  try {
    const growthSourceStmt = db.prepare(`
      SELECT
        source,
        COUNT(*) as cnt,
        SUM(CASE WHEN status IN ('demo_sent', 'checkout_opened', 'converted') THEN 1 ELSE 0 END) as trials_cnt,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as paid_cnt
      FROM growth_leads
      WHERE created_at >= ?
      GROUP BY source
    `);
    const sourceRows = await growthSourceStmt.bind(windowStartMs).all<{
      source: string; cnt: number; trials_cnt: number; paid_cnt: number;
    }>();

    if (sourceRows.results) {
      for (const row of sourceRows.results) {
        if (sourceStats[row.source]) {
          sourceStats[row.source] = { leads: row.cnt || 0, trials: row.trials_cnt || 0, paid: row.paid_cnt || 0 };
        }
      }
    }
  } catch {
    // Non-fatal
  }

  let viralLinksViews = 0, viralLinksClicks = 0, viralLinksLeads = 0, viralLinksConversions = 0;
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
      total_views: number; total_clicks: number; total_leads: number; total_conversions: number;
    }>();
    if (vSummary) {
      viralLinksViews = vSummary.total_views || 0;
      viralLinksClicks = vSummary.total_clicks || 0;
      viralLinksLeads = vSummary.total_leads || 0;
      viralLinksConversions = vSummary.total_conversions || 0;
    }
  } catch {
    // Non-fatal
  }

  let tgBotLeads = 0, tgBotTrials = 0, tgBotPaid = 0;
  try {
    const tgStatsStmt = db.prepare(`
      SELECT
        COUNT(*) as cnt,
        SUM(CASE WHEN (status IN ('demo_sent', 'checkout_sent', 'converted') OR demo_video_sent_at IS NOT NULL) THEN 1 ELSE 0 END) as trials_cnt,
        SUM(CASE WHEN (status = 'paid' OR is_paid = 1) THEN 1 ELSE 0 END) as paid_cnt
      FROM telegram_leads
      WHERE created_at >= ?
    `);
    const tgRes = await tgStatsStmt.bind(windowStartMs).first<{ cnt: number; trials_cnt: number; paid_cnt: number }>();
    if (tgRes) {
      tgBotLeads = tgRes.cnt || 0;
      tgBotTrials = tgRes.trials_cnt || 0;
      tgBotPaid = tgRes.paid_cnt || 0;
    }
  } catch {
    // Non-fatal
  }

  let affiliateClicks = 0;
  try {
    const affClicksStmt = db.prepare('SELECT COUNT(*) as cnt FROM affiliate_referral_clicks WHERE created_at >= ?');
    const affRes = await affClicksStmt.bind(windowStartMs).first<{ cnt: number }>();
    affiliateClicks = affRes?.cnt || 0;
  } catch {
    // Non-fatal
  }

  return [
    {
      channel: 'viral_videos',
      channelLabelEn: 'Viral Videos (TikTok, Shorts, X)',
      channelLabelVi: 'Video Viral (TikTok, Shorts, X)',
      leads: sourceStats.viral_video.leads + viralLinksLeads,
      trials: sourceStats.viral_video.trials,
      paid: sourceStats.viral_video.paid + viralLinksConversions,
      visitors: Math.max(viralLinksViews, viralLinksClicks, (sourceStats.viral_video.leads + viralLinksLeads) * 3),
    },
    {
      channel: 'telegram_bot',
      channelLabelEn: 'Telegram Bot Automated Sales',
      channelLabelVi: 'Bot Telegram Tư Vấn & Chốt Sales',
      leads: sourceStats.telegram_bot.leads + tgBotLeads,
      trials: sourceStats.telegram_bot.trials + tgBotTrials,
      paid: sourceStats.telegram_bot.paid + tgBotPaid,
      visitors: Math.max((sourceStats.telegram_bot.leads + tgBotLeads) * 2, sourceStats.telegram_bot.trials + tgBotTrials),
    },
    {
      channel: 'programmatic_seo',
      channelLabelEn: 'Programmatic SEO Solutions',
      channelLabelVi: 'Trang Giải Pháp SEO Theo Ngành',
      leads: sourceStats.seo_landing.leads,
      trials: sourceStats.seo_landing.trials,
      paid: sourceStats.seo_landing.paid,
      visitors: Math.max(sourceStats.seo_landing.leads * 4, sourceStats.seo_landing.trials),
    },
    {
      channel: 'affiliate_partners',
      channelLabelEn: 'Affiliate Partner Program',
      channelLabelVi: 'Đối Tác Tiếp Thị Liên Kết',
      leads: sourceStats.affiliate.leads,
      trials: sourceStats.affiliate.trials,
      paid: sourceStats.affiliate.paid,
      visitors: Math.max(affiliateClicks, sourceStats.affiliate.leads * 2),
    },
  ];
}
