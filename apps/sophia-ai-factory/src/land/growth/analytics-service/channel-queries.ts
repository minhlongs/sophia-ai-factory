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
import {
  queryViralFunnelSummary,
  queryTelegramBotStats,
  queryAffiliateReferralClicks,
} from './channel-sub-queries';

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
          sourceStats[row.source] = {
            leads: row.cnt || 0,
            trials: row.trials_cnt || 0,
            paid: row.paid_cnt || 0,
          };
        }
      }
    }
  } catch {
    // Non-fatal
  }

  const {
    viralLinksViews,
    viralLinksClicks,
    viralLinksLeads,
    viralLinksConversions,
  } = await queryViralFunnelSummary(db, windowStartMs);

  const { tgBotLeads, tgBotTrials, tgBotPaid } = await queryTelegramBotStats(db, windowStartMs);
  const affiliateClicks = await queryAffiliateReferralClicks(db, windowStartMs);

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
