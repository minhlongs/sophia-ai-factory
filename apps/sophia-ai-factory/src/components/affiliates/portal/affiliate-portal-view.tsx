'use client';

/**
 * Affiliate Partner Dashboard Portal View Component
 *
 * Assembles KPI grid, tracking link builder, payout drawer, and transaction ledger.
 *
 * Layer: components/affiliates/portal
 * @module components/affiliates/portal/affiliate-portal-view
 */

import React, { useState } from 'react';
import { AffiliatePortalKpiGrid } from './affiliate-portal-kpi-grid';
import { AffiliateTrackingLinksCard } from './affiliate-tracking-links-card';
import { AffiliateCommissionLedgerTable } from './affiliate-commission-ledger-table';
import { AffiliatePayoutDrawer } from './affiliate-payout-drawer';
import type {
  PartnerLedgerKpiData,
  CommissionLedgerItem,
} from '@/forest/actions/affiliate-payout-actions-schema';

interface AffiliatePortalViewProps {
  partnerId: string;
  initialKpi: PartnerLedgerKpiData;
  initialItems: CommissionLedgerItem[];
}

export function AffiliatePortalView({
  partnerId,
  initialKpi,
  initialItems,
}: AffiliatePortalViewProps) {
  const [kpi] = useState<PartnerLedgerKpiData>(initialKpi);
  const [items] = useState<CommissionLedgerItem[]>(initialItems);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const handlePayoutSuccess = (payoutId: string) => {
    setSuccessBanner(`Payout request ${payoutId} submitted for dual-rail processing.`);
    setTimeout(() => setSuccessBanner(null), 6000);
  };

  return (
    <div className="space-y-6">
      {successBanner && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {successBanner}
        </div>
      )}

      {/* Financial KPIs */}
      <AffiliatePortalKpiGrid
        kpi={kpi}
        onRequestPayout={() => setIsDrawerOpen(true)}
      />

      {/* Referral Link & Campaign Builder */}
      <AffiliateTrackingLinksCard partnerCode={kpi.partnerCode} />

      {/* Full Commission Audit Ledger */}
      <AffiliateCommissionLedgerTable items={items} />

      {/* Dual-Rail Payout Drawer Modal */}
      <AffiliatePayoutDrawer
        partnerId={partnerId}
        availableCents={kpi.availablePayoutCents}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={handlePayoutSuccess}
      />
    </div>
  );
}
