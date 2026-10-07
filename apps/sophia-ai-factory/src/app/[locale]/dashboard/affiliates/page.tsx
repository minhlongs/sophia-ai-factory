/**
 * Niche Affiliate Analytics Dashboard
 *
 * Visualizes affiliate pipeline throughput, geo-routed bridge page clicks,
 * postback revenue attribution, and UCB1 Multi-Armed Bandit hook rankings.
 *
 * Layer: app/[locale]/dashboard/affiliates (Presentation)
 */

import React from 'react';
import {
  AffiliateCockpitView,
  generateExecutiveCockpitSnapshot,
} from '@/land/affiliates/dashboard';
import type { ScalingDecision } from '@/tree/affiliate/scaling/auto-campaign-scaler';

interface AffiliateMetrics {
  totalVideosGenerated: number;
  totalBridgeClicks: number;
  totalCommissionUsd: number;
  activeNiches: string[];
}

export default async function AffiliatesDashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  // Mocked aggregated metrics from D1 / Land layer
  const metrics: AffiliateMetrics = {
    totalVideosGenerated: 142,
    totalBridgeClicks: 3840,
    totalCommissionUsd: 1248.5,
    activeNiches: ['saas_global', 'crypto_global'],
  };

  const defaultScalingDecisions: ScalingDecision[] = [
    {
      campaignId: 'camp-01',
      hookName: 'Secret AI Tool Nobody Knows',
      ctrPercent: 5.4,
      cvrPercent: 3.2,
      epcCents: 482,
      recommendedDailyVideos: 4,
      action: 'SCALE_AGGRESSIVE',
      reason: 'High EPC and conversion rate',
    },
    {
      campaignId: 'camp-02',
      hookName: 'Solana Meme Breakout Alert',
      ctrPercent: 4.8,
      cvrPercent: 2.7,
      epcCents: 365,
      recommendedDailyVideos: 4,
      action: 'SCALE_AGGRESSIVE',
      reason: 'Consistent yield on Crypto audience',
    },
    {
      campaignId: 'camp-03',
      hookName: 'Dev Tool 10x Velocity',
      ctrPercent: 1.8,
      cvrPercent: 1.1,
      epcCents: 120,
      recommendedDailyVideos: 1,
      action: 'MAINTAIN_STEADY',
      reason: 'Moderate baseline engagement',
    },
  ];

  const defaultReconciliation = {
    tenantId: 'default',
    totalGrossCommissionCents: 124850,
    totalHoldbackCents: 12485,
    totalNetPayableCents: 112365,
    totalRefundedCents: 0,
    totalOrdersProcessed: 86,
    highRiskRefundRate: false,
    entries: [],
  };

  const cockpitSnapshot = generateExecutiveCockpitSnapshot({
    tenantId: 'default',
    reconciliation: defaultReconciliation,
    scalingDecisions: defaultScalingDecisions,
    killSwitchActive: false,
  });

  const topHookArms = [
    { name: 'Secret AI Tool Nobody Knows', niche: 'SaaS Global', rpm: '$48.20', ucbScore: 9.84, status: 'Exploiting' },
    { name: 'Solana Meme Breakout Alert', niche: 'Crypto Global', rpm: '$36.50', ucbScore: 7.92, status: 'Exploiting' },
    { name: 'Dev Tool 10x Velocity', niche: 'SaaS Global', rpm: '$12.00', ucbScore: 6.40, status: 'Exploring' },
  ];

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {locale === 'vi' ? 'Bảng Điều Khiển Tiếp Thị Liên Kết' : 'Affiliate Flywheel Dashboard'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {locale === 'vi'
            ? 'Theo dõi tự động hóa sản xuất video, lưu lượng truy cập qua Bridge Page và tối ưu hóa chuyển đổi hoa hồng.'
            : 'Track automated video syndication, geo-targeted bridge link conversions, and MAB hook yield.'}
        </p>
      </div>

      {/* Executive Affiliate Revenue & Risk Cockpit */}
      <AffiliateCockpitView
        snapshot={cockpitSnapshot}
        locale={locale === 'vi' ? 'vi' : 'en'}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            {locale === 'vi' ? 'Tổng Doanh Thu Hoa Hồng' : 'Total Commission Earned'}
          </p>
          <h3 className="text-3xl font-bold mt-2 text-primary">
            ${metrics.totalCommissionUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {locale === 'vi' ? 'Từ PartnerStack, Binance & Bybit' : 'From PartnerStack, Binance & Bybit'}
          </p>
        </div>

        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            {locale === 'vi' ? 'Lượt Click Qua Bridge Page' : 'Bridge Page Clicks'}
          </p>
          <h3 className="text-3xl font-bold mt-2">
            {metrics.totalBridgeClicks.toLocaleString()}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {locale === 'vi' ? 'Tự động định tuyến theo IP Cloudflare' : 'Geo-routed via Cloudflare Edge'}
          </p>
        </div>

        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            {locale === 'vi' ? 'Video Tự Động Phân Phối' : 'Syndicated Videos'}
          </p>
          <h3 className="text-3xl font-bold mt-2">
            {metrics.totalVideosGenerated}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {locale === 'vi' ? 'TikTok, YouTube Shorts, X' : 'TikTok, YouTube Shorts, X'}
          </p>
        </div>
      </div>

      {/* MAB Hook Angle Ranking Table */}
      <div className="rounded-xl border bg-card shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground">
          {locale === 'vi' ? 'Xếp Hạng Hook Video (Thuật toán UCB1 MAB)' : 'MAB UCB1 Hook Angle Rankings'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{locale === 'vi' ? 'Tên Hook' : 'Hook Angle'}</th>
                <th className="px-4 py-3">{locale === 'vi' ? 'Thị Trường' : 'Niche'}</th>
                <th className="px-4 py-3">{locale === 'vi' ? 'Doanh Thu / 1k Lượt Xem' : 'RPM (Est.)'}</th>
                <th className="px-4 py-3">{locale === 'vi' ? 'Điểm UCB1' : 'UCB1 Score'}</th>
                <th className="px-4 py-3">{locale === 'vi' ? 'Trạng Thái' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topHookArms.map((arm, idx) => (
                <tr key={idx} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{arm.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{arm.niche}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">{arm.rpm}</td>
                  <td className="px-4 py-3 font-mono text-xs">{arm.ucbScore.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        arm.status === 'Exploiting'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {arm.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
