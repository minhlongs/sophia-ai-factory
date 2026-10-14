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
import {
  DEFAULT_AFFILIATE_METRICS,
  DEFAULT_SCALING_DECISIONS,
  DEFAULT_RECONCILIATION,
  AffiliateHookRankingTable,
} from './affiliates-dashboard-sections';

export default async function AffiliatesDashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const metrics = DEFAULT_AFFILIATE_METRICS;

  const cockpitSnapshot = generateExecutiveCockpitSnapshot({
    tenantId: 'default',
    reconciliation: DEFAULT_RECONCILIATION,
    scalingDecisions: DEFAULT_SCALING_DECISIONS,
    killSwitchActive: false,
  });

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
      <AffiliateHookRankingTable locale={locale} />
    </div>
  );
}
