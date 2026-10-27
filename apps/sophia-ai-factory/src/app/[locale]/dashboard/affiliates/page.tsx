/**
 * Niche Affiliate Analytics Dashboard
 *
 * Visualizes affiliate pipeline throughput, geo-routed bridge page clicks,
 * postback revenue attribution, and UCB1 Multi-Armed Bandit hook rankings
 * backed by real workspace Domain B ledger data.
 *
 * Layer: app/[locale]/dashboard/affiliates (Presentation)
 */

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { createServerClient } from '@/seed/db/client';
import { isAffiliateKillSwitchActive } from '@/tree/affiliate/kill-switch/kill-switch-store';
import {
  AffiliateCockpitView,
  generateExecutiveCockpitSnapshot,
  mapDomainBToReconciliationSummary,
} from '@/land/affiliates/dashboard';
import {
  fetchWorkspaceDomainBReconciliation,
  type DomainBReconciliationSummary,
} from '@/land/affiliates/reconciliation/workspace-domain-b-reconciliation';
import {
  EMPTY_AFFILIATE_METRICS,
  EMPTY_RECONCILIATION,
  AffiliateHookRankingTable,
  type AffiliateMetrics,
} from './affiliates-dashboard-sections';

async function loadWorkspaceAffiliateDashboardData(): Promise<{
  tenantId: string;
  domainBSummary?: DomainBReconciliationSummary;
  metrics: AffiliateMetrics;
  killSwitchActive: boolean;
}> {
  let tenantId = 'unauthenticated';
  try {
    const user = await getCurrentUser();
    if (user?.id) {
      try {
        const db = createServerClient();
        const orgId = await resolveOrgId(user.id, db).catch(() => null);
        tenantId = orgId ?? user.id;

        const rawD1: D1Database | null =
          typeof (db as { unwrap?: () => D1Database }).unwrap === 'function'
            ? (db as { unwrap: () => D1Database }).unwrap()
            : typeof (db as { prepare?: unknown }).prepare === 'function'
              ? (db as unknown as D1Database)
              : null;

        const domainBRes = rawD1
          ? await fetchWorkspaceDomainBReconciliation(rawD1, tenantId)
          : null;
        const domainBSummary = domainBRes?.ok ? domainBRes.value : undefined;
        const killSwitchActive = await isAffiliateKillSwitchActive(tenantId).catch(() => false);

        const totalCommissionUsd = domainBSummary
          ? domainBSummary.effectiveCommissionCents / 100
          : 0;

        return {
          tenantId,
          domainBSummary,
          metrics: {
            ...EMPTY_AFFILIATE_METRICS,
            totalCommissionUsd,
          },
          killSwitchActive,
        };
      } catch {
        tenantId = user.id;
      }
    }
  } catch {
    // Unauthenticated or test environment without session context
  }

  return {
    tenantId,
    domainBSummary: undefined,
    metrics: EMPTY_AFFILIATE_METRICS,
    killSwitchActive: false,
  };
}

export default async function AffiliatesDashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const { tenantId, domainBSummary, metrics, killSwitchActive } =
    await loadWorkspaceAffiliateDashboardData();

  const reconciliation = domainBSummary
    ? mapDomainBToReconciliationSummary(domainBSummary)
    : { ...EMPTY_RECONCILIATION, tenantId };

  const cockpitSnapshot = generateExecutiveCockpitSnapshot({
    tenantId,
    reconciliation,
    scalingDecisions: [],
    killSwitchActive,
    domainBSummary,
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
