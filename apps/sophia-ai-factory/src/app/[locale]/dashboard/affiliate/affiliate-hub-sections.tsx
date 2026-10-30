import React from 'react';
import { AffiliateCockpitView, type CockpitExecutiveSnapshot } from '@/land/affiliates/dashboard';
import { AffiliatePortalView } from '@/components/affiliates/portal/affiliate-portal-view';
import {
  getWorkspaceWebhookReadiness,
  CANONICAL_WEBHOOK_NETWORK_LIST,
  NETWORK_CONFIGS,
} from '@/app/api/webhooks/affiliate/[network]/affiliate-network-configs';
import { getD1 } from '@/seed/db/client';
import type {
  PartnerLedgerKpiData,
  CommissionLedgerItem,
} from '@/forest/actions/affiliate-payout-actions-schema';

export interface AffiliateHubSupplementarySectionsProps {
  userId: string;
  partnerCode: string;
  commissionRatePct: number;
  totalEarningsCents: number;
  pendingPayoutCents: number;
  availablePayoutCents: number;
  totalClicks: number;
  totalConversions: number;
  conversionRatePct: number;
  locale: string;
  ledgerItems?: CommissionLedgerItem[];
}

export async function AffiliateHubSupplementarySections({
  userId,
  partnerCode,
  commissionRatePct,
  totalEarningsCents,
  pendingPayoutCents,
  availablePayoutCents,
  totalClicks,
  totalConversions,
  conversionRatePct,
  locale,
  ledgerItems = [],
}: AffiliateHubSupplementarySectionsProps) {
  const isVi = locale === 'vi';
  const db = await getD1();
  // Fail-closed display: without a database read we cannot prove any network
  // is connected for this workspace, so every badge renders pending.
  const webhookReadiness = db
    ? await getWorkspaceWebhookReadiness(db, userId)
    : CANONICAL_WEBHOOK_NETWORK_LIST.map((net) => ({
        network: net,
        secretEnv: NETWORK_CONFIGS[net].secretEnv,
        configured: false,
      }));

  const snapshot: CockpitExecutiveSnapshot = {
    tenantId: userId,
    generatedAtMs: Date.now(),
    metrics: {
      totalGrossCommissionCents: totalEarningsCents,
      totalHoldbackReserveCents: pendingPayoutCents,
      totalNetPayableCents: availablePayoutCents,
      totalRefundedCents: 0,
      effectiveRefundRatePercent: 0,
      isRefundRiskAlert: false,
      activeCampaignsCount: 0,
      scaledWinnersCount: 0,
      prunedHooksCount: 0,
    },
    topPerformingHooks: [],
    killSwitchActive: false,
  };

  const portalKpi: PartnerLedgerKpiData = {
    availablePayoutCents,
    availablePayoutVnd: availablePayoutCents * 254,
    pendingHoldCents: pendingPayoutCents,
    nextHoldReleaseDays: 14,
    totalSettledCents: Math.max(0, totalEarningsCents - pendingPayoutCents),
    totalClicks,
    totalReferrals: totalConversions,
    conversionRatePct,
    partnerCode,
    commissionRatePct,
    defaultRail: 'VIETQR',
    maskedDestination: '•••••••• (Self-Serve)',
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-12 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-bold text-foreground">
          {isVi
            ? 'Trạng thái Webhook Postback Mạng Affiliate (Model A & B)'
            : 'Affiliate Network Postback Webhook Readiness (Model A & B)'}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {isVi
            ? 'Tự động ghi nhận hoa hồng qua /api/webhooks/affiliate/[network] khi cấu hình secret.'
            : 'Automatically records conversions via /api/webhooks/affiliate/[network] when secret is set.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {webhookReadiness.map((item) => (
            <span
              key={item.network}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                item.configured
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${item.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {item.network}: {item.configured ? (isVi ? 'Đã kết nối' : 'Active') : (isVi ? 'Chờ cấu hình' : 'Pending Secret')}
            </span>
          ))}
        </div>
      </div>

      <AffiliateCockpitView snapshot={snapshot} locale={isVi ? 'vi' : 'en'} />

      <AffiliatePortalView
        partnerId={userId}
        initialKpi={portalKpi}
        initialItems={ledgerItems}
      />
    </div>
  );
}
