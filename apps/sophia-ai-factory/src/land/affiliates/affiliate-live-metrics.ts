import { getD1 } from '@/seed/db/client';
import type { AffiliateMetrics } from '@/app/[locale]/dashboard/affiliates/affiliates-dashboard-sections';

interface LiveAffiliateMetricsResult {
  metrics: AffiliateMetrics;
  isLive: boolean;
}

export async function loadLiveAffiliateMetrics(userId: string): Promise<LiveAffiliateMetricsResult> {
  try {
    const db = await getD1();
    if (!db) {
      return {
        metrics: {
          totalVideosGenerated: 0,
          totalBridgeClicks: 0,
          totalCommissionUsd: 0,
          activeNiches: ['saas_global', 'crypto_global'],
        },
        isLive: false,
      };
    }

    // 1. Total videos generated (campaigns for this user)
    const videosRes = await db
      .prepare(`SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?1`)
      .bind(userId)
      .first<{ count: number }>();
    const totalVideosGenerated = videosRes?.count ?? 0;

    // 2. Partner profile & clicks
    const partnerRes = await db
      .prepare(`SELECT id FROM affiliate_partners WHERE user_id = ?1`)
      .bind(userId)
      .first<{ id: string }>();

    let totalBridgeClicks = 0;
    let totalCommissionCents = 0;

    if (partnerRes?.id) {
      const clicksRes = await db
        .prepare(`SELECT COUNT(*) as count FROM affiliate_referral_clicks WHERE affiliate_partner_id = ?1`)
        .bind(partnerRes.id)
        .first<{ count: number }>();
      totalBridgeClicks = clicksRes?.count ?? 0;

      const ledgerRes = await db
        .prepare(`SELECT COALESCE(SUM(commission_cents), 0) as total FROM commission_ledger WHERE affiliate_id = ?1`)
        .bind(partnerRes.id)
        .first<{ total: number }>();
      totalCommissionCents = ledgerRes?.total ?? 0;
    }

    return {
      metrics: {
        totalVideosGenerated,
        totalBridgeClicks,
        totalCommissionUsd: totalCommissionCents / 100,
        activeNiches: ['saas_global', 'crypto_global'],
      },
      isLive: true,
    };
  } catch {
    return {
      metrics: {
        totalVideosGenerated: 0,
        totalBridgeClicks: 0,
        totalCommissionUsd: 0,
        activeNiches: ['saas_global', 'crypto_global'],
      },
      isLive: false,
    };
  }
}
