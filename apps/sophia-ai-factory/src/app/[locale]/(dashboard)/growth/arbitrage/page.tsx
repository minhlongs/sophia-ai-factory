import React from 'react';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getArbitrageMetrics,
  type ArbitrageDashboardMetrics,
} from '@/land/growth/arbitrage-coordinator';
import {
  ArbitrageCard,
  type ArbitrageMetricsData,
  type ArbitragePlatformRow,
} from '@/components/growth/arbitrage-card';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return {
    title: isVi
      ? 'Chênh lệch Lan truyền & Chi phí Tính toán | Sophia AI Factory'
      : 'Cross-Platform Virality & Compute Arbitrage | Sophia AI Factory',
    description: isVi
      ? 'Hệ thống tự động hóa tối ưu hóa tiếp cận đa nền tảng TikTok, YouTube Shorts, IG Reels và điều phối tính toán ngoài giờ cao điểm.'
      : 'Automated reach multiplier across TikTok, YouTube Shorts, and IG Reels with opportunistic off-peak compute arbitrage.',
  };
}

function mapMetricsToCardData(metrics: ArbitrageDashboardMetrics): ArbitrageMetricsData {
  const platformMatrix: ArbitragePlatformRow[] = metrics.platformMatrix.map((item) => {
    let name = 'TikTok';
    if (item.platform === 'YOUTUBE_SHORTS') name = 'YouTube Shorts';
    if (item.platform === 'INSTAGRAM_REELS') name = 'Instagram Reels';

    return {
      platform: item.platform,
      name,
      governingMetric: item.governingMetric,
      calculatedScore: item.calculatedScore,
      hookMutation: item.hookMutation,
      status: item.status === 'OPTIMIZED' ? 'Optimized' : 'Queued',
    };
  });

  return {
    reachLiftPercentage: metrics.reachLiftPercentage,
    computeSavingsUsd: metrics.totalComputeSavingsUsd,
    activeHookDivergenceJsd: metrics.activeHookDivergenceJsd,
    shadowbanAvoidanceRate: metrics.shadowbanAvoidanceRate * 100,
    platformMatrix,
    computeHud: {
      regime: metrics.computeRegime === 'OFF_PEAK_QUEUE' ? 'OFF-PEAK QUEUE' : metrics.computeRegime,
      regimeDescription:
        'Non-urgent b-roll batch generation held for low-cost window (02:00-08:00 UTC). Marginal savings: 42%.',
      heygenDispatched: 18,
      heygenCapacityPercent: 75,
      didDispatched: 42,
      didCapacityPercent: 45,
      circuitBreakerStatus: 'ALL CLOSED (HEALTHY)',
    },
  };
}

export default async function ArbitrageDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const user = await getCurrentUser();

  const tenantId = user?.id ?? 'default-tenant';
  const metricsResult = await getArbitrageMetrics(tenantId);

  const cardData = metricsResult.ok
    ? mapMetricsToCardData(metricsResult.value)
    : undefined;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <ArbitrageCard
        data={cardData}
        locale={isVi ? 'vi' : 'en'}
      />
    </main>
  );
}
